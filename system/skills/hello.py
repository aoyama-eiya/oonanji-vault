from agent_core import Tool

class HelloTool(Tool):
    def __init__(self):
        super().__init__(
            name="hello_world",
            description="A sample skill that says hello.",
            parameters={"type": "object", "properties": {}, "required": []}
        )

    async def execute(self, **kwargs) -> str:
        return "Hello from the dynamic skill system! Oonanji Vault is now extensible."

tool = HelloTool()
