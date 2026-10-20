# Versioning

SemVer `MAJOR.MINOR.PATCH` (mesmo padrao dos repos Illustrator e Scripts AE).

A versao fica em sintonia em quatro lugares:

```text
cep-panel/CSXS/manifest.xml  -> ExtensionBundleVersion e Extension Version
cep-panel/jsx/host.jsx       -> var PRMCP_VERSION (aparece no painel e no premiere_status)
server/package.json          -> version
server/index.js              -> new McpServer({ version })
```

Mais o titulo e o changelog do `README.md` e rodar `python build_zip.py`. Commits em portugues:
`fix: ...`, `feat: ...`, `release: Premiere MCP v1.0.0`.

## ZIP de distribuicao

A cada versao, regenerar o ZIP (apaga o anterior) e commitar junto:

```bash
python build_zip.py
```

O nome sai da versao em `server/package.json`. O script grava caminhos com `/` e marca
`.command`/`.sh` como executaveis; `Compress-Archive` e `tar` do Windows nao fazem isso e o
macOS se recusa a abrir o `.command`.
