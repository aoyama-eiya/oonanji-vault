
with open('/opt/oonanji-vault/system/agent_core.py', 'r') as f:
    lines = f.readlines()
    line_512 = lines[511] # 0-indexed
    line_513 = lines[512]
    print(f"Line 512 indent: {len(line_512) - len(line_512.lstrip())}")
    print(f"Line 513 indent: {len(line_513) - len(line_513.lstrip())}")
    print(f"Line 512 content: {repr(line_512)}")
    print(f"Line 513 content: {repr(line_513)}")
