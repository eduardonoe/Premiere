# Gera Premiere_MCP_<versao>.zip para distribuir. Uso: python build_zip.py
# Marca .command/.sh como executaveis (0755), senao o macOS nao abre com duplo clique.
import json, pathlib, zipfile

root = pathlib.Path(__file__).parent
ver = json.loads((root / "server/package.json").read_text())["version"]
name = f"Premiere_MCP_{ver}"
for old in root.glob("Premiere_MCP_*.zip"):
    old.unlink()
with zipfile.ZipFile(root / f"{name}.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for src in ["LEIA-ME.txt", "PC", "MAC", "cep-panel", "skill", "server"]:
        paths = [root / src] if (root / src).is_file() else sorted((root / src).rglob("*"))
        for p in paths:
            rel = p.relative_to(root).as_posix()
            if p.is_dir() or "node_modules" in rel:
                continue
            info = zipfile.ZipInfo.from_file(p, f"{name}/{rel}")
            info.external_attr = (0o755 if p.suffix in (".command", ".sh") else 0o644) << 16
            info.create_system = 3  # unix: senao o macOS ignora as permissoes
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, p.read_bytes())
print(f"{name}.zip")
