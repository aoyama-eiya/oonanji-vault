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

class MemoryTool(Tool):
    def __init__(self, db_handler=None):
        super().__init__(
            name="memory",
            description="""Remembers key facts about the user (e.g., name, preferences, work style).
Use this to personalize future interactions.
- action='remember': Store a fact (e.g., key='name', value='Taro')
- action='forget': Remove a fact""",
            parameters={
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["remember", "forget"]},
                    "key": {"type": "string", "description": "The aspect to remember (e.g., 'user_name')"},
                    "value": {"type": "string", "description": "The details to store"}
                },
                "required": ["action", "key"]
            }
        )
        self.db_handler = db_handler

    async def execute(self, **kwargs) -> str:
        args = kwargs.get("args", kwargs)
        action = args.get("action")
        key = args.get("key")
        value = args.get("value")
        
        if not self.db_handler:
            return "Error: Memory database not initialized."
            
        try:
            if action == "remember":
                if not value: return "Error: Value required to remember."
                self.db_handler(key, value)
                return f"I will remember that {key} is {value}."
            elif action == "forget":
                # Handle forget logic if needed, but for now just overwrite or IGNORE
                return "Memory updated."
            return f"Unknown action {action}"
        except Exception as e:
            return f"Memory Error: {e}"



class CanvasTool(Tool):
    """
    Canvas tool for presenting content.
    Supports standard code presentation and A4 Document Writer template.
    """
    
    def __init__(self, db_handler=None, db_save_handler=None):
        self.db_handler = db_handler
        self.db_save_handler = db_save_handler
        super().__init__(
            name="canvas",
            description="""Present content in the side panel. 
For DOCUMENTS/REPORTS: Use 'template="document"' and provide ONLY the text body (Markdown supported).
For APPS/CODE: Use 'template="none"' (default) and provide full single-file HTML/JS/CSS.
To EDIT existing: Use 'action="read"' with 'canvas_id' first.""",
            parameters={
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["present", "update", "clear", "read"]},
                    "content": {"type": "string", "description": "The text/code content."},
                    "language": {"type": "string", "default": "html"},
                    "title": {"type": "string"},
                    "template": {"type": "string", "enum": ["none", "document"], "description": "Use 'document' for A4 reports."},
                    "canvas_id": {"type": "string", "description": "ID of canvas to read/edit"}
                },
                "required": ["action"]
            }
        )
        self.current_content = ""
        self.current_body_text = ""
        self.current_language = "html"
        self.current_title = ""

    def _format_code(self, code: str, language: str) -> str:
        """Attempt to format code if it looks minified."""
        code = code.strip()
        if not code: return code
        if "\n" in code and len(code.split('\n')) > 1: return code  # Already multiline
        
        # Simple heuristic formatter
        if language in ["html", "xml", "svg"]:
            try:
                import xml.dom.minidom
                dom = xml.dom.minidom.parseString(code)
                return dom.toprettyxml(indent="  ")
            except: pass
        
        if language in ["javascript", "css", "c", "cpp", "java", "json", "python", "typescript"]:
            formatted = ""
            indent = 0
            in_string = False
            for char in code:
                if char == '{' and not in_string:
                    formatted += "{\n" + "  " * (indent + 1)
                    indent += 1
                elif char == '}' and not in_string:
                    formatted += "\n" + "  " * (indent - 1) + "}"
                    indent -= 1
                elif char == ';' and not in_string:
                    formatted += ";\n" + "  " * indent
                else:
                    formatted += char
            return formatted if len(formatted) > len(code) else code
            
        return code



    async def execute(self, **kwargs) -> str:
        args = kwargs.get("args", kwargs)
        action = args.get("action", "present")
        content = args.get("content", "")
        language = args.get("language", "html")
        title = args.get("title", "")
        template = args.get("template", "none")
        canvas_id = args.get("canvas_id")
        session_id = args.get("session_id") # Injected by agent

        if action == "read":
             if not self.db_handler or not canvas_id:
                 return "Error: Database handler or canvas_id missing."
             
             try:
                 data = self.db_handler(canvas_id)
                 if not data: return f"Error: Canvas ID {canvas_id} not found."
                 
                 self.current_content = data['content']
                 self.current_language = data['language']
                 self.current_title = data['title']
                 # Check if it's a doc
                 if self.current_language == 'document' or data.get('template') == 'document':
                     self.current_body_text = self.current_content
                     template = "document" 
                 
                 result = {
                    "canvas_action": "present",
                    "content": self.current_content,
                    "language": self.current_language,
                    "title": self.current_title,
                    "canvas_id": canvas_id
                }
                 return f"[CANVAS_UPDATE]{json.dumps(result)}[/CANVAS_UPDATE]\nSuccessfully read canvas {canvas_id}. Content loaded."
             except Exception as e:
                 return f"Error reading canvas: {e}"

        # Logic to handle Document vs Standard Code
        is_document_mode = (template == "document") or (self.current_body_text and template != "none")

        try:
            if is_document_mode:
                # --- DOCUMENT MODE ---
                if action == "present":
                    self.current_body_text = content
                    if title: self.current_title = title
                    self.current_language = "document"
                elif action == "update":
                    self.current_body_text += "\n" + content
                    if title: self.current_title = title
                elif action == "clear":
                    self.current_body_text = ""
                    self.current_title = ""
                
                self.current_content = self.current_body_text
                self.current_language = "document"
            else:
                # --- STANDARD APP/CODE MODE ---
                if action == "present" and template == "none":
                    self.current_body_text = "" 

                if action == "present":
                    final_content = self._format_code(content, language)
                    self.current_content = final_content
                    self.current_language = language
                    self.current_title = title
                elif action == "update":
                    formatted_chunk = self._format_code(content, language)
                    self.current_content += "\n" + formatted_chunk
                    if title: self.current_title = title
                elif action == "clear":
                    self.current_content = ""
                    self.current_language = "html"
                    self.current_title = ""
            
            # --- AUTO PERSISTENCE ---
            import uuid
            if action in ["present", "update"] and self.db_save_handler and session_id:
                 if not canvas_id:
                     canvas_id = str(uuid.uuid4())
                 
                 try:
                     self.db_save_handler(
                         canvas_id=canvas_id,
                         session_id=session_id,
                         title=self.current_title or "Untitled",
                         content=self.current_content,
                         language=self.current_language
                     )
                 except Exception as e:
                     print(f"Error auto-saving canvas: {e}")

            result = {
                "canvas_action": action,
                "content": self.current_content,
                "language": self.current_language,
                "title": self.current_title,
                "canvas_id": canvas_id # Return ID so frontend/agent knows
            }
            
            # For documents, return explicit message
            msg = "Docs App" if is_document_mode else "Code Mode"
            
            return f"[CANVAS_UPDATE]{json.dumps(result)}[/CANVAS_UPDATE]\nCanvas updated ({msg}). ID: {canvas_id}"
                
        except Exception as e:
            return f"Canvas Error: {e}"

    def get_current_state(self) -> dict:
        """Get the current canvas state."""
        return {
            "content": self.current_content,
            "language": self.current_language,
            "title": self.current_title
        }


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
            "You are Oonanji Agent, a professional AI partner.\n"
            "**LANGUAGE:** You MUST speak the SAME LANGUAGE as the User.\n"
            "You have access to the following tools:\n"
            f"{self._get_tool_schemas_json()}\n\n"
            "## CANVAS USAGE RULES\n"
            "1. **DOCUMENTS (Docs App):**\n"
            "   - Use `template='document'` to open the **Docs App**.\n"
            "   - **Concept:** You are WRITING TEXT into the Docs App. The App handles the layout/design.\n"
            "   - **Content:** Provide ONLY the body text (Markdown headers '#', lists, etc). NO HTML tags.\n"
            "   - Example: `{\"tool\": \"canvas\", \"args\": {\"action\": \"present\", \"template\": \"document\", \"title\": \"Proposal\", \"content\": \"# Title\\n...\"}}`\n"
            "2. **APPS / CODE (Standard Canvas):**\n"
            "   - Use `template='none'`.\n"
            "   - **Concept:** You are writing raw code (HTML/JS) for a custom widget.\n"
            "   - **Content:** FULL single-file HTML including `<!DOCTYPE html>`.\n"
            "3. **GENERAL:**\n"
            "   - Start with `Thinking: ...`.\n"
            "   - Output valid JSON inside ```json ... ``` block.\n"
            "   - **AFTER CREATION:** You MUST output a Final Answer (e.g., 'Docsに提案書を作成しました').\n"
            "4. **PROACTIVE CREATION:**\n"
            "   - **DO NOT ASK FOR CLARIFICATION.**\n"
            "   - **IMMEDIATELY** use the `canvas` tool with a best-guess draft.\n"
            "   - **NEVER** just say 'I will create it'—ACTUALLY CALL THE TOOL.\n\n"
        )


        max_steps = 10
        step = 0
        canvas_payload = None
        
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
                         elif "json {" in stream_buffer or "json{" in stream_buffer:
                             target = "json {" if "json {" in stream_buffer else "json{"
                             idx = stream_buffer.find(target)
                             pre = stream_buffer[:idx]
                             if pre:
                                 # In UNKNOWN mode, if we find JSON, anything before it is implicitly thought.
                                 yield {"thought_chunk": "> " + pre.replace("\n", "\n\n> ")}
                             mode = 'tool'
                             in_json_block = True
                             stream_buffer = "" 
                             continue  
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

                     elif "json {" in stream_buffer or "json{" in stream_buffer:
                         target = "json {" if "json {" in stream_buffer else "json{"
                         idx = stream_buffer.find(target)
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
             # === PARSING ===
             import re
             # 1. Standard Code Block
             json_match = re.search(r"```json\s*(\{.*?\})\s*```", full_response_text, re.DOTALL)
             
             # 2. Loose (json { ... }) format
             if not json_match:
                 json_match = re.search(r"\(json\s*(\{.*?\})\s*\)", full_response_text, re.DOTALL)

             # 3. Bare JSON with "tool" key
             if not json_match:
                 json_match = re.search(r"(\{.*\"tool\":\s*\"[a-zA-Z0-9_]+\".*\})", full_response_text, re.DOTALL)

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



                     if tool_name == "canvas":
                          tool_instance = self.tools[tool_name]
                          # INJECT session_id into tool_args
                          tool_args['session_id'] = context.session_id 
                          
                          result = await tool_instance.execute(args=tool_args)
                          
                          # Retrieve processed content from tool state
                          final_content = tool_instance.current_content
                          lang = tool_instance.current_language
                          title = tool_instance.current_title
                          canvas_payload = f"<<<CANVAS_START>>>\nLanguage: {lang}\nTitle: {title}\n<<<CONTENT_START>>>\n{final_content}<<<CANVAS_END>>>"
                          
                          # Direct Event Stream for backend.py
                          yield {"canvas_update": {
                              "content": final_content,
                              "language": lang,
                              "title": title
                          }}
                          
                          yield {"observation": result}
                          
                          # Feed simplified observation to agent to save context
                          obs_text = f"Canvas updated. Title: {title}. Language: {lang}. Size: {len(final_content)} chars."
                          
                          current_messages.append(AgentMessage(role="assistant", content=full_response_text))
                          current_messages.append(AgentMessage(role="user", content=f"Observation: {obs_text}"))
                          step += 1
                          continue

                     elif tool_name in self.tools:
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
                   # payload already streamed

                  context.history.append(AgentMessage(role="assistant", content=full_response_text))
                  yield {"final": full_response_text}
                  return
         
        yield {"final": "Error: Maximum reasoning steps exceeded."}

    def _get_tool_schemas_json(self):
        schemas = [t.to_schema() for t in self.tools.values()]
        return json.dumps(schemas, indent=2, ensure_ascii=False)

# SkillManager removed per user request

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

    def initialize(self, reflex_path: str = "", planner_path: str = "", db_handler = None, db_save_handler = None, db_memory_handler = None):
        # Determine model paths via model manager or defaults
        self.reflex_model_path = reflex_path or self.model_manager.fast_model_path
        self.planner_model_path = planner_path or self.model_manager.smart_model_path
        
        print(f"Agent using Reflex: {self.reflex_model_path}, Planner: {self.planner_model_path}", flush=True)

        reflex_brain = LocalLlamaBrain(self.model_manager, self.reflex_model_path, n_gpu_layers=33)
        planner_brain = LocalLlamaBrain(self.model_manager, self.planner_model_path, n_gpu_layers=33)
        
        self.agent = OonanjiAgent(reflex_brain, planner_brain)
        
        # Register Core Tools
        self.agent.register_tool(FileTool())
        self.agent.register_tool(CanvasTool(db_handler=db_handler, db_save_handler=db_save_handler))
        self.agent.register_tool(MemoryTool(db_handler=db_memory_handler))
        
        # Skill Manager REMOVED as per user request
        # self.skill_manager = SkillManager(self.agent, "/opt/oonanji-vault/skills")
        # self.agent.register_tool(SkillCreatorTool(self.skill_manager.skill_dir))
        # self.skill_manager.load_skills()

    async def a_run_loop(self, session_id: str, user_message: str):
        if session_id not in self.sessions:
            self.sessions[session_id] = AgentContext(session_id=session_id)
        
        context = self.sessions[session_id]
        
        # Run the solo loop strictly
        async for event in self.agent.run_solo_loop(context, user_message):
            yield event
