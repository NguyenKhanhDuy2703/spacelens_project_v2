import time
from watchfiles import watch

print("Đang theo dõi thay đổi file... Hãy đợi log xuất hiện...")
for changes in watch('.'):
    for change_type, file_path in changes:
        print(f"Loại thay đổi: {change_type} | File: {file_path}")