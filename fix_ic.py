import shutil, os, subprocess

NEXUS = '/Users/maxime/Downloads/NexusBot'
SESSION = '/Users/maxime/Library/Application Support/Claude/local-agent-mode-sessions/gracious-charming-ride/mnt'

# Copy dump to sandbox-accessible location
src = os.path.join(NEXUS, 'DUMP_ALL.txt')
dst = os.path.join(SESSION, 'DUMP_ALL.txt')
os.makedirs(SESSION, exist_ok=True)
shutil.copy2(src, dst)
print(f'Copied {src} -> {dst}')
print(f'Size: {os.path.getsize(dst)} bytes')
