# Instrucoes para agentes

Leia `README.md` e `VERSIONING.md` antes de alterar algo.

- Host roda ExtendScript ES3 (sem let/const/arrow/JSON nativo confiavel).
- Painel e CEP (nao UXP) e roda em PC e Mac: caminhos via APPDATA no Windows e
  ~/Library/Application Support no Mac. Mudou um instalador? Espelhe no outro.
- Nada de daemon nem janela visivel: o usuario quer tudo em background.
- Depois de alterar, rode `PC\install.ps1` (Mac: `MAC/install.sh`) para
  reinstalar; o agente usa a copia instalada em `%APPDATA%\prmcp\server`, nao este repo.
- Atualize a versao nos quatro lugares e o changelog quando o comportamento mudar.
- Commit com mensagem clara em portugues.
