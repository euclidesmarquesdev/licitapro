@echo off
set "output=estrutura_src.txt"

echo === LISTAGEM COMPLETA DA PASTA SRC === > "%output%"

for /r "src" %%f in (*) do (
    echo.>>"%output%"
    echo ===== Arquivo: %%f =====>>"%output%"
    type "%%f">>"%output%"
)

echo.
echo ===============================
echo Arquivo gerado: %output%
echo ===============================
pause