# Electron (opcional)

Casca na raiz que abre o painel React.

## Instalação

Na raiz: `npm install` (instala `electron` e `wait-on`). Mantenha **Electron** atualizado (`npm audit` na raiz); versões antigas podem ter avisos de segurança corrigidos em releases recentes.

## Desenvolvimento

Com API + Vite + janela Electron:

```bash
npm run electron:dev
```

Só Electron (com servidores já a correr): `npm run electron`.

## Build estático para janela

PowerShell:

```powershell
$env:ELECTRON_BUILD='1'; npm run build --prefix frontend
```

Depois: `set NODE_ENV=production` e `npm run electron` (API em paralelo).

## Versão NuGet

Para futuros instaladores Windows (Squirrel / electron-winstaller):

```bash
npm run version:nuget
```

Conversão manual: `node scripts/nuget-version.mjs 1.0.0-beta.1`.
