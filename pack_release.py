import os
import zipfile

# ============================================================
# 忽略列表（相对路径），支持文件名、文件夹（请以 '/' 结尾）
# ============================================================
IGNORE_LIST = [
    "README.md",        # 忽略根目录下的 README.md
    "res/",             # 忽略整个 res 文件夹及其内容
    ".github/",       # 按需添加，例如忽略工作流目录
    "pack_release.py",# 一般会自动排除脚本自身，但也可写在这里
    ".gitattributes",
    ".gitignore",
    ".git/",
    "cache.json"
]

def should_ignore(rel_path: str) -> bool:
    """
    判断给定相对路径是否应被忽略。
    rel_path 可能是文件路径或目录路径（目录路径以 '/' 结尾）。
    """
    for pattern in IGNORE_LIST:
        # 匹配目录（以 '/' 结尾）
        if pattern.endswith("/"):
            # 目录本身或其下任意内容
            if rel_path == pattern.rstrip("/") or rel_path.startswith(pattern):
                return True
        else:
            # 精确匹配文件，或匹配该文件名在任何目录下
            if rel_path == pattern or os.path.basename(rel_path) == pattern:
                return True
    return False

def create_zip(output_name="ErjcmPack.zip", root="."):
    with zipfile.ZipFile(output_name, "w", zipfile.ZIP_DEFLATED) as zf:
        for dirpath, dirnames, filenames in os.walk(root):
            # 过滤掉被忽略的目录（这样 os.walk 就不会再进入它们）
            dirnames[:] = [
                d for d in dirnames
                if not should_ignore(os.path.relpath(os.path.join(dirpath, d), root) + "/")
            ]

            for fname in filenames:
                full = os.path.join(dirpath, fname)
                rel = os.path.relpath(full, root)

                # 跳过被忽略的文件
                if should_ignore(rel):
                    continue
                # 避免把脚本自身和输出的 zip 打入包中
                if rel in ("pack_release.py", output_name):
                    continue

                zf.write(full, rel)

if __name__ == "__main__":
    create_zip()
    print("✅ ErjcmPack.zip 打包完成")