import os
import re

questions_dir = 'frontend/src/data/questions'

count = 0
for root, dirs, files in os.walk(questions_dir):
    for file in files:
        if file.endswith('.ts'):
            filepath = os.path.join(root, file)

            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            if '\\%' in content:
                new_content = content.replace('\\%', '%')

                with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
                    f.write(new_content)

                count += 1

print(f"Fixed {count} files")
