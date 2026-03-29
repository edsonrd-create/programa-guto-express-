# Backend como serviço no Windows (NSSM)

[NSSM](https://nssm.cc/) instala o Node como serviço Windows (início automático, reinício em falha).

## Pré-requisitos

- Node.js LTS instalado (ex.: `C:\Program Files\nodejs\node.exe`).
- Cópia do projeto em disco fixo, ex.: `C:\apps\guto-express\backend`.

## Passos (PowerShell ou CMD como administrador)

1. Descarregar `nssm.exe` (mesma arquitetura que o Windows) e colocar no PATH ou numa pasta fixa.

2. Instalar o serviço:

```bat
nssm install GutoExpressAPI "C:\Program Files\nodejs\node.exe"
```

3. Na janela do NSSM (ou linha de comandos):

- **Application** → *Path*: `C:\Program Files\nodejs\node.exe`  
- **Application** → *Startup directory*: `C:\apps\guto-express\backend`  
- **Application** → *Arguments*: `src\server.js`  
- **Details** → *Display name*: `Guto Express API`  
- **I/O** → redirecionar *stdout/stderr* para ficheiros de log se quiser.  
- **Environment** → `NODE_ENV=production` e outras variáveis, **ou** apontar para um ficheiro `.env` carregado pelo `loadEnv.js` na pasta `backend`.

4. Iniciar:

```bat
nssm start GutoExpressAPI
```

5. Ver estado: `services.msc` ou `nssm status GutoExpressAPI`.

## Firewall

Abra a porta TCP usada pelo backend (por defeito **3210**) nas regras de entrada do Windows Defender Firewall, se o painel aceder de outra máquina.

## Backup

Agendar `BACKUP-DB.cmd` ou `npm run backup:db` na raiz do repositório com o **Agendador de tarefas** do Windows.
