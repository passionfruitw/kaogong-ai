import os
import re

questions_dir = 'frontend/src/data/questions'

# 需要检查的文件列表（从错误日志中提取）
problem_files = [
    'frontend/src/data/questions/2020国考副省级/question_20201001135.ts',
    'frontend/src/data/questions/2020国考地市/question_20201002001.ts',
]

fixed_count = 0

for filepath in problem_files:
    if not os.path.exists(filepath):
        print(f"[WARN] File not found: {filepath}")
        continue

    try:
        # 读取文件
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # 检查是否有问题字符
        if '\r' in content:
            print(f"[FIX] CRLF: {filepath}")
            content = content.replace('\r\n', '\n').replace('\r', '\n')
            fixed_count += 1

        # 检查是否有 \%
        if '\\%' in content:
            print(f"[FIX] Backslash percent: {filepath}")
            content = content.replace('\\%', '%')
            fixed_count += 1

        # 重新写入文件，确保使用 UTF-8 和 LF
        with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
            f.write(content)

        print(f"[OK] {filepath}")

    except Exception as e:
        print(f"[ERROR] {filepath}: {e}")

print(f"\nTotal fixes: {fixed_count}")
