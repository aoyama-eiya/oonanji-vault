import logging
import json
import asyncio
import re
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel
from datetime import datetime

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("oonanji-agent")

# --- Data Structures ---

class AgentMessage(BaseModel):
    role: str  # "user", "assistant", "system", "tool"
    content: str
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None

class AgentContext(BaseModel):
    session_id: str
    history: List[AgentMessage] = []
    variables: Dict[str, Any] = {}

# --- Tools Base ---

class Tool:
    def __init__(self, name: str, description: str, parameters: Dict[str, Any]):
        self.name = name
        self.description = description
        self.parameters = parameters

    async def execute(self, **kwargs) -> str:
        raise NotImplementedError("Tool execution not implemented")

    def to_schema(self) -> Dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters
            }
        }

# --- Brains (LLM Wrappers) ---

class BaseBrain:
    def __init__(self, model_manager, model_path: str, n_gpu_layers: int = None):
        self.model_manager = model_manager
        self.model_path = model_path
        self.n_gpu_layers = n_gpu_layers

    async def generate_response(self, messages: List[AgentMessage], tools: Optional[List[Tool]] = None) -> AgentMessage:
        raise NotImplementedError

class LocalLlamaBrain(BaseBrain):
    """Wrapper for the local Llama/GGUF models via ModelManager"""

    async def generate_stream(self, messages: List[AgentMessage], tools: Optional[List[Tool]] = None):
        print(f"DEBUG: Brain querying model (STREAM): {self.model_path} with {len(messages)} messages", flush=True)
        loop = asyncio.get_event_loop()
        import concurrent.futures
        
        # Stream Logic
        queue = asyncio.Queue()
        
        def _inference_stream():
            try:
                llm = self.model_manager.get_llm(self.model_path, n_gpu_layers=self.n_gpu_layers)
                if not llm:
                    queue.put_nowait(None) # Signal end
                    return

                llama_messages = [{"role": m.role, "content": m.content} for m in messages]
                
                if hasattr(self.model_manager, 'thread_lock'):
                    lock_obj = self.model_manager.thread_lock
                else:
                    import threading
                    lock_obj = threading.RLock()

                with lock_obj:
                     # Using create_chat_completion with stream=True
                     # Note: llama-cpp-python streaming returns an iterator
                     stream_iter = llm.create_chat_completion(
                        messages=llama_messages,
                        max_tokens=1024,
                        temperature=0.7, 
                        stream=True
                    )
                     for chunk in stream_iter:
                         delta = chunk['choices'][0]['delta']
                         if 'content' in delta:
                             queue.put_nowait(delta['content'])
                
                queue.put_nowait(None) # Signal end of stream
            except Exception as e:
                print(f"Inference Error: {e}", flush=True)
                queue.put_nowait(f"[Error: {e}]")
                queue.put_nowait(None)

        # Run inference in thread
        loop.run_in_executor(None, _inference_stream)
        
        while True:
            chunk = await queue.get()
            if chunk is None:
                break
            yield chunk

    async def generate_response(self, messages: List[AgentMessage], tools: Optional[List[Tool]] = None) -> AgentMessage:
        # Backward compatibility wrapper
        content = ""
        async for chunk in self.generate_stream(messages, tools):
            content += chunk
        return AgentMessage(role="assistant", content=content)

# --- Tools Implementation ---

# Imports removed per user request (Browser/Exec tools deleted)


# Tools removed per user request



import os
import glob

class FileTool(Tool):
    def __init__(self):
        super().__init__(
            name="file_ops",
            description="Read, Write, List, or Edit files in the workspace.",
            parameters={
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["read", "write", "list", "search"]},
                    "path": {"type": "string", "description": "File or directory path"},
                    "content": {"type": "string", "description": "Content to write (for write action)"},
                    "pattern": {"type": "string", "description": "Glob pattern (for search/list)"}
                },
                "required": ["action", "path"]
            }
        )
        self.root_dir = "/opt/oonanji-vault"

    async def execute(self, **kwargs) -> str:
        args = kwargs.get("args", kwargs)
        action = args.get("action")
        path = args.get("path", ".")
        
        # Security: Prevent escaping root (basic check)
        full_path = os.path.abspath(os.path.join(self.root_dir, path.lstrip('/')))
        if not full_path.startswith(self.root_dir):
            return "Error: Access denied (outside workspace)."

        try:
            if action == "read":
                if not os.path.exists(full_path): return "Error: File not found."
                with open(full_path, 'r', encoding='utf-8') as f:
                    return f.read()[:10000] # Limit output
            
            elif action == "write":
                content = args.get("content")
                if content is None: return "Error: Content required for write."
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                return f"Successfully wrote to {path}"
            
            elif action == "list":
                if os.path.isdir(full_path):
                    items = os.listdir(full_path)
                    return "\n".join(items[:100])
                else:
                    return "Error: Not a directory."
                    
            elif action == "search":
                pattern = args.get("pattern", "*")
                search_path = os.path.join(full_path, pattern)
                files = glob.glob(search_path, recursive=True)
                return "\n".join([f.replace(self.root_dir, "") for f in files[:50]])

            return f"Error: Unknown action {action}"
        except Exception as e:
            return f"File Error: {e}"


class CanvasTool(Tool):
    """
    Canvas tool for the agent to generate and present visual content.
    Inspired by ClawdBot's Live Canvas functionality.
    
    The agent can use this tool to:
    - Present HTML/CSS/JS code in the Canvas panel
    - Generate UI components, visualizations, and interactive elements
    - Update the canvas with new content dynamically
    """
    
    def __init__(self):
        super().__init__(
            name="canvas",
            description="""Present content to the user's Canvas panel. Use this to show:
- Generated HTML/CSS/JS code for UI components
- Markdown documentation or reports
- Code snippets in any programming language
- Interactive visualizations

The content will be displayed in the Canvas panel where users can view, edit, and download it.""",
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string", 
                        "enum": ["present", "update", "clear"],
                        "description": "Action to perform: 'present' to show new content, 'update' to modify existing, 'clear' to reset"
                    },
                    "content": {
                        "type": "string", 
                        "description": "The content to display (HTML, CSS, JS, Markdown, or any code)"
                    },
                    "language": {
                        "type": "string", 
                        "description": "Language/type of content: html, css, javascript, python, markdown, etc.",
                        "default": "html"
                    },
                    "title": {
                        "type": "string",
                        "description": "Optional title for the canvas content"
                    }
                },
                "required": ["action", "content"]
            }
        )
        # This will hold the current canvas state
        self.current_content = ""
        self.current_language = "html"
        self.current_title = ""
    
    async def execute(self, **kwargs) -> str:
        args = kwargs.get("args", kwargs)
        action = args.get("action", "present")
        content = args.get("content", "")
        language = args.get("language", "html")
        title = args.get("title", "")
        
        try:
            if action == "present":
                self.current_content = content
                self.current_language = language
                self.current_title = title
                
                # Return a special marker that backend.py will parse
                # to send canvas content to the frontend
                result = {
                    "canvas_action": "present",
                    "content": content,
                    "language": language,
                    "title": title
                }
                return f"[CANVAS_UPDATE]{json.dumps(result)}[/CANVAS_UPDATE]\nCanvas updated with {language} content ({len(content)} characters)."
                
            elif action == "update":
                # Append or modify existing content
                self.current_content += "\n" + content
                result = {
                    "canvas_action": "update",
                    "content": self.current_content,
                    "language": self.current_language,
                    "title": self.current_title
                }
                return f"[CANVAS_UPDATE]{json.dumps(result)}[/CANVAS_UPDATE]\nCanvas content updated."
                
            elif action == "clear":
                self.current_content = ""
                self.current_language = "html"
                self.current_title = ""
                result = {
                    "canvas_action": "clear",
                    "content": "",
                    "language": "html",
                    "title": ""
                }
                return f"[CANVAS_UPDATE]{json.dumps(result)}[/CANVAS_UPDATE]\nCanvas cleared."
                
            else:
                return f"Error: Unknown canvas action '{action}'. Valid actions: present, update, clear"
                
        except Exception as e:
            return f"Canvas Error: {e}"
    
    def get_current_state(self) -> dict:
        """Get the current canvas state."""
        return {
            "content": self.current_content,
            "language": self.current_language,
            "title": self.current_title
        }


class SkillCreatorTool(Tool):
    """
    Tool for the agent to create and manage its own skills.
    Inspired by ClawdBot's self-improving capability.
    
    Skills are Python files saved in the skills directory that define new tools.
    """
    
    def __init__(self, skill_dir: str = None):
        super().__init__(
            name="skill_manager",
            description="""Create, list, or delete skills (reusable tools). Use this when you need to:
- Create a new tool for a repetitive task
- Save code that can be reused later
- List available skills
- Delete an unused skill

Skills are Python files that define Tool classes. Once created, they are automatically loaded on startup.""",
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["create", "list", "delete", "view"],
                        "description": "Action to perform"
                    },
                    "name": {
                        "type": "string",
                        "description": "Skill name (for create/delete/view)"
                    },
                    "description": {
                        "type": "string", 
                        "description": "What the skill does (for create)"
                    },
                    "code": {
                        "type": "string",
                        "description": "Python code for the skill (for create). Must define a Tool subclass."
                    }
                },
                "required": ["action"]
            }
        )
        self.skill_dir = skill_dir or os.path.join(os.path.dirname(__file__), "skills")
        os.makedirs(self.skill_dir, exist_ok=True)
    
    async def execute(self, **kwargs) -> str:
        args = kwargs.get("args", kwargs)
        action = args.get("action", "list")
        name = args.get("name", "")
        description = args.get("description", "")
        code = args.get("code", "")
        
        try:
            if action == "list":
                skills = []
                if os.path.exists(self.skill_dir):
                    for f in os.listdir(self.skill_dir):
                        if f.endswith('.py') and not f.startswith('_'):
                            skills.append(f[:-3])
                if skills:
                    return f"Available skills: {', '.join(skills)}"
                return "No skills found. Create one with action='create'."
            
            elif action == "create":
                if not name:
                    return "Error: Skill name required"
                if not code:
                    return "Error: Skill code required"
                
                # Sanitize name
                safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', name.lower())
                file_path = os.path.join(self.skill_dir, f"{safe_name}.py")
                
                # Generate skill template if just function code provided
                if "class" not in code and "Tool" not in code:
                    # Wrap user code in a proper Tool class
                    skill_code = f'''"""
Auto-generated skill: {name}
Description: {description}
"""
from agent_core import Tool
import json

class {safe_name.title()}Tool(Tool):
    def __init__(self):
        super().__init__(
            name="{safe_name}",
            description="""{description}""",
            parameters={{
                "type": "object",
                "properties": {{
                    "input": {{"type": "string", "description": "Input for the skill"}}
                }},
                "required": []
            }}
        )
    
    async def execute(self, **kwargs) -> str:
        args = kwargs.get("args", kwargs)
        input_val = args.get("input", "")
        
        # User-defined logic
{chr(10).join("        " + line for line in code.split(chr(10)))}

# Export the tool
tool = {safe_name.title()}Tool()
'''
                else:
                    skill_code = code
                
                # Save the skill
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(skill_code)
                
                return f"✅ Skill '{safe_name}' created successfully at {file_path}. It will be available after restart."
            
            elif action == "view":
                if not name:
                    return "Error: Skill name required"
                safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', name.lower())
                file_path = os.path.join(self.skill_dir, f"{safe_name}.py")
                
                if not os.path.exists(file_path):
                    return f"Error: Skill '{name}' not found"
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                return f"Skill '{name}':\n```python\n{content}\n```"
            
            elif action == "delete":
                if not name:
                    return "Error: Skill name required"
                safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', name.lower())
                file_path = os.path.join(self.skill_dir, f"{safe_name}.py")
                
                if not os.path.exists(file_path):
                    return f"Error: Skill '{name}' not found"
                
                os.remove(file_path)
                return f"✅ Skill '{name}' deleted. Changes will take effect after restart."
            
            else:
                return f"Error: Unknown action '{action}'. Valid: create, list, view, delete"
                
        except Exception as e:
            return f"Skill Manager Error: {e}"

# --- Agent Core (ClawdBot Logic) ---

class OonanjiAgent:
    def __init__(self, reflex_brain: BaseBrain, planner_brain: BaseBrain):
        self.reflex_brain = reflex_brain
        self.planner_brain = planner_brain
        self.tools: Dict[str, Tool] = {}
        
    def register_tool(self, tool: Tool):
        self.tools[tool.name] = tool
        
    def _is_complex_task(self, last_message: str) -> bool:
        # "Always On" for complex reasoning if keywords match, effectively making it "agentic"
        # Expanded keywords to catch more questions and requests
        keywords = [
            "check", "search", "create", "analyze", "browser", "look up", "run", "exec", 
            "command", "list", "ls", "pwd", "grep", "cat", "terminal", "console", 
            "date", "time", "調べ", "検索", "ブラウザ", "天気", "ニュース", "今日", "時間", 
            "what", "who", "where", "when", "calculate", "file", "read", "write",
            "教えて", "何", "誰", "どこ", "いつ", "？", "?", "知りたい", "わからない", "詳しく",
            "summary", "summarize", "要約", "とは", "って", "make", "作って"
        ]
        return any(k in last_message.lower() for k in keywords)

    async def run_solo_loop(self, context: AgentContext, user_message: str):
        """
        Single-Model ReAct Loop (Chain of Thought) with Smart Streaming.
        """
        # 1. Add User Message to History
        context.history.append(AgentMessage(role="user", content=user_message))
        
        system_prompt = (
            "You are Oonanji Agent, a professional and proactive AI partner.\n"
            "You have access to the following tools:\n"
            f"{self._get_tool_schemas_json()}\n\n"
            "## WORKFLOW\n"
            "1. **CONSULT & PROPOSE:** For content tasks (e.g. 'Create Profile', 'Write Email'), DO NOT use coding tools immediately. Instead:\n"
            "   - Propose a template or draft using `canvas`.\n"
            "   - Ask the user for specific preferences or details (Hearing).\n"
            "2. **EXECUTE:** Only use tools if necessary.\n"
            "   - Use `canvas` for any content > 3 lines (Profiles, Code, Reports).\n"
            "   - **WARNING:** Do NOT use `skill_manager` or `file_ops` unless the user asks to 'edit files', 'save code', or 'create a tool'. For creative text, just write it in Canvas.\n"
            "3. **FINISH:** When done, output 'Final Answer: [Summary]'.\n\n"
            "## RULES\n"
            "1. **BE A SECRETARY.** Think: 'What does the user need?'. If they want a profile, give them a draft, don't build a profile-generator-tool.\n"
            "2. **NATURAL JAPANESE.** detailed, polite, and helpful.\n"
            "3. **FORMAT:**\n"
            "   - **Thinking:** Start with `Thinking: [reasoning]`.\n"
            "   - **Tool:** Use JSON ```json { ... } ```.\n"
            "   - **Answer:** End with `Final Answer: [response]`.\n"
            "4. **Language.** Respond in Japanese.\n"
        )

        max_steps = 10
        step = 0
        
        recent_history = context.history[-15:] if len(context.history) > 15 else context.history
        current_messages = [AgentMessage(role="system", content=system_prompt)] + recent_history
        
        while step < max_steps:
             yield {"status": f"Thinking (Step {step+1})..."}
             
             full_response_text = ""
             
             # Modes: 'unknown', 'thought', 'answer', 'tool'
             mode = 'unknown' 
             stream_buffer = ""
             in_json_block = False
             
             async for chunk in self.reflex_brain.generate_stream(current_messages):
                 full_response_text += chunk
                 stream_buffer += chunk
                 
                 # === 1. UNKNOWN MODE (Buffering start) ===
                 if mode == 'unknown':
                     if len(stream_buffer) > 50 or "\n" in stream_buffer:
                         s = stream_buffer.strip().lower()
                         if s.startswith("thinking:") or s.startswith("thought:"):
                             mode = 'thought'
                             yield {"thought_chunk": "> " + stream_buffer.replace("\n", "\n\n> ")}
                             stream_buffer = ""
                         elif "```json" in stream_buffer:
                             mode = 'tool'
                             in_json_block = True
                             # keep buffer for parsing later, or clear it if we don't show it?
                             # We hide tool JSON.
                             stream_buffer = "" 
                         elif s.startswith("final answer:"):
                             mode = 'answer'
                             # Strip prefix
                             import re
                             clean = re.sub(r'^final answer:\s*', '', stream_buffer, flags=re.IGNORECASE)
                             yield {"thought_chunk": clean}
                             stream_buffer = ""
                         else:
                             mode = 'answer'
                             yield {"thought_chunk": stream_buffer}
                             stream_buffer = ""
                     continue

                 # === 2. THOUGHT MODE ===
                 if mode == 'thought':
                     # Check triggers in the complete current buffer (which is usually small, just recent chunks?)
                     # No, stream_buffer should implicitly be "pending output".
                     # Actually, to handle split tokens, we need to KEEP the potential tokens in buffer.
                     
                     # Check for Final Answer (Case Insensitive)
                     # We use a lower version for checking
                     buf_lower = stream_buffer.lower()
                     
                     if "final answer:" in buf_lower:
                         # Found it!
                         idx = buf_lower.find("final answer:")
                         
                         # Part before is thought
                         pre = stream_buffer[:idx]
                         if pre:
                             yield {"thought_chunk": pre.replace("\n", "\n\n> ")}
                             
                         # Close quote
                         yield {"thought_chunk": "\n\n"}
                         
                         # Part after is answer
                         # "final answer:" is 13 chars.
                         post = stream_buffer[idx+13:].lstrip() # strip leading space/colon residue if any
                         # Wait, strict checking: current buffer has "Final Answer:..."
                         
                         mode = 'answer'
                         yield {"thought_chunk": post}
                         stream_buffer = ""
                         continue

                     if "```json" in stream_buffer:
                         idx = stream_buffer.find("```json")
                         pre = stream_buffer[:idx]
                         if pre:
                             yield {"thought_chunk": pre.replace("\n", "\n\n> ")}
                         
                         yield {"thought_chunk": "\n\n"}
                         mode = 'tool'
                         in_json_block = True
                         stream_buffer = "" # Hide JSON
                         continue

                     # Safe Output Logic
                     # If buffer gets too long, output the safe part (beginning), keeping the end for potential split tokens.
                     SAFE_WINDOW = 20
                     if len(stream_buffer) > SAFE_WINDOW:
                         to_yield = stream_buffer[:-SAFE_WINDOW]
                         rest = stream_buffer[-SAFE_WINDOW:]
                         yield {"thought_chunk": to_yield.replace("\n", "\n\n> ")}
                         stream_buffer = rest
                     
                     continue

                 # === 3. ANSWER MODE ===
                 if mode == 'answer':
                     # Just stream immediately
                     yield {"thought_chunk": stream_buffer}
                     stream_buffer = ""
                     continue

                 # === 4. TOOL MODE (Hidden) ===
                 if mode == 'tool':
                     stream_buffer = "" # Discard tool output from stream (it's hidden)
                     continue

             # End of Stream Loop
             
             # Flush remaining buffer
             if stream_buffer:
                 if mode == 'thought':
                     yield {"thought_chunk": stream_buffer.replace("\n", "\n\n> ")}
                 elif mode == 'answer':
                     yield {"thought_chunk": stream_buffer}
                 elif mode == 'unknown':
                     yield {"thought_chunk": stream_buffer}

             # === PARSING ===
             import re
             json_match = re.search(r"```json\s*(\{.*?\})\s*```", full_response_text, re.DOTALL)
             if not json_match:
                 json_match = re.search(r"^\s*(\{.*\"tool\":.*\})\s*$", full_response_text, re.DOTALL | re.MULTILINE)

             if json_match:
                 try:
                     from json import loads
                     try:
                          tool_data = json.loads(json_match.group(1))
                     except:
                          import ast
                          tool_data = ast.literal_eval(json_match.group(1))

                     tool_name = tool_data.get("tool")
                     tool_args = tool_data.get("args", {})
                     thought = tool_data.get("thought", "")
                     
                     if thought:
                          yield {"thought_chunk": f"\n\n> **Thinking:** {thought}\n\n> "}

                     if tool_name in self.tools:
                         yield {"status": f"Executing {tool_name}...", "action": tool_name, "input": json.dumps(tool_args)}
                         
                         tool_instance = self.tools[tool_name]
                         result = await tool_instance.execute(args=tool_args)
                         
                         yield {"observation": result}
                         
                         current_messages.append(AgentMessage(role="assistant", content=full_response_text))
                         current_messages.append(AgentMessage(role="user", content=f"Observation: {result}"))
                         step += 1
                         continue
                     else:
                         yield {"thought_chunk": f"\n\n> [System: Tool '{tool_name}' not found.]"}

                 except Exception as e:
                      yield {"thought_chunk": f"\n\n> [System: Parsing Error: {e}]"}
             
             else:
                  # No tool usage. Check for Final Answer logic.
                  context.history.append(AgentMessage(role="assistant", content=full_response_text))
                  yield {"final": full_response_text}
                  return
         
        yield {"final": "Error: Maximum reasoning steps exceeded."}

    def _get_tool_schemas_json(self):
        schemas = [t.to_schema() for t in self.tools.values()]
        return json.dumps(schemas, indent=2, ensure_ascii=False)

# --- Skill Loader ---
import importlib.util

class SkillManager:
    def __init__(self, agent: OonanjiAgent, skill_dir: str):
        self.agent = agent
        self.skill_dir = skill_dir

    def load_skills(self):
        if not os.path.exists(self.skill_dir):
            return
        
        py_files = glob.glob(os.path.join(self.skill_dir, "*.py"))
        for file_path in py_files:
            try:
                module_name = os.path.basename(file_path)[:-3]
                spec = importlib.util.spec_from_file_location(module_name, file_path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                
                # Look for a 'tool' attribute or 'get_tool' function
                if hasattr(module, 'tool') and isinstance(module.tool, Tool):
                    self.agent.register_tool(module.tool)
                    logger.info(f"Loaded skill: {module_name}")
                elif hasattr(module, 'get_tool'):
                    tool = module.get_tool()
                    if isinstance(tool, Tool):
                        self.agent.register_tool(tool)
                        logger.info(f"Loaded skill (factory): {module_name}")
            except Exception as e:
                logger.error(f"Failed to load skill {file_path}: {e}")

# --- Gateway ---

class AgentGateway:
    def __init__(self, model_manager):
        self.model_manager = model_manager
        self.sessions: Dict[str, AgentContext] = {}
        self.agent: Optional[OonanjiAgent] = None
        self.reflex_model_path = ""
        self.planner_model_path = ""
        
        # Tools
        self.skill_manager = None

    def initialize(self, reflex_path: str = "", planner_path: str = ""):
        # Determine model paths via model manager or defaults
        self.reflex_model_path = reflex_path or self.model_manager.fast_model_path
        self.planner_model_path = planner_path or self.model_manager.smart_model_path
        
        print(f"Agent using Reflex: {self.reflex_model_path}, Planner: {self.planner_model_path}", flush=True)

        reflex_brain = LocalLlamaBrain(self.model_manager, self.reflex_model_path, n_gpu_layers=33)
        planner_brain = LocalLlamaBrain(self.model_manager, self.planner_model_path, n_gpu_layers=33)
        
        self.agent = OonanjiAgent(reflex_brain, planner_brain)
        
        # Register Core Tools
        self.agent.register_tool(FileTool())
        self.agent.register_tool(CanvasTool())
        
        # Register Skill Manager
        self.skill_manager = SkillManager(self.agent, "/opt/oonanji-vault/skills")
        self.agent.register_tool(SkillCreatorTool(self.skill_manager.skill_dir))
        
        # Load Skills
        self.skill_manager.load_skills()

    async def a_run_loop(self, session_id: str, user_message: str):
        if session_id not in self.sessions:
            self.sessions[session_id] = AgentContext(session_id=session_id)
        
        context = self.sessions[session_id]
        
        # Run the solo loop strictly
        async for event in self.agent.run_solo_loop(context, user_message):
            yield event
