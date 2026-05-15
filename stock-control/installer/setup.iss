#define AppName "Control de Stock"
#define AppVersion "2.0"
#define AppID "{F3A7B2C1-D4E5-4F60-9ABC-123456789ABC}"

[Setup]
AppId={#AppID}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} v{#AppVersion}
AppPublisher=Mi Empresa
DefaultDirName=C:\xampp\htdocs\stock-control
DefaultGroupName={#AppName}
AllowNoIcons=yes
OutputBaseFilename=stock-control-setup-v2
OutputDir=output
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
DisableDirPage=no
SetupIconFile=
UninstallDisplayName={#AppName}

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Messages]
spanish.BeveledLabel={#AppName} v{#AppVersion}

[Files]
; Archivos de la aplicación
Source: "files\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Schema SQL (se copia a carpeta temporal y se borra al terminar)
Source: "schema.sql"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{group}\Abrir {#AppName}"; Filename: "{win}\explorer.exe"; Parameters: "http://localhost/stock-control/"; IconFilename: "{win}\explorer.exe"
Name: "{group}\Desinstalar {#AppName}"; Filename: "{uninstallexe}"

[Run]
; Importar base de datos solo si el usuario lo eligió
Filename: "{code:GetMysqlExe}"; \
  Parameters: "-u root {code:GetPassParam} -e ""CREATE DATABASE IF NOT EXISTS stock_control CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"""; \
  StatusMsg: "Creando base de datos..."; \
  Flags: runhidden waituntilterminated; \
  Check: ShouldImportDB

Filename: "{code:GetMysqlExe}"; \
  Parameters: "-u root {code:GetPassParam} stock_control < ""{tmp}\schema.sql"""; \
  StatusMsg: "Importando tablas y datos..."; \
  Flags: runhidden waituntilterminated; \
  Check: ShouldImportDB

; Abrir el navegador al finalizar
Filename: "{code:GetBrowserExe}"; \
  Parameters: "http://localhost/stock-control/"; \
  Description: "Abrir {#AppName} en el navegador ahora"; \
  Flags: postinstall shellexec skipifsilent nowait

[Code]

var
  // Páginas personalizadas
  XamppPage:    TInputDirWizardPage;
  DBPage:       TInputQueryWizardPage;
  OptionsPage:  TInputOptionWizardPage;

  // Valores detectados/ingresados
  XamppDir:     String;
  DBPassword:   String;
  ImportDB:     Boolean;

// ─── Detectar XAMPP automáticamente ─────────────────────────────────────────

function DetectXampp: String;
var
  Paths: TArrayOfString;
  i: Integer;
begin
  SetArrayLength(Paths, 6);
  Paths[0] := 'C:\xampp';
  Paths[1] := 'C:\XAMPP';
  Paths[2] := 'D:\xampp';
  Paths[3] := 'C:\xampp\mysql\bin\mysql.exe';
  Paths[4] := 'E:\xampp';
  Paths[5] := ExpandConstant('{pf}\xampp');

  for i := 0 to 2 do begin
    if DirExists(Paths[i]) then begin
      Result := Paths[i];
      Exit;
    end;
  end;
  Result := 'C:\xampp';
end;

// ─── Getters para los parámetros de los comandos ────────────────────────────

function GetMysqlExe(Param: String): String;
begin
  Result := XamppDir + '\mysql\bin\mysql.exe';
end;

function GetPassParam(Param: String): String;
begin
  if DBPassword = '' then
    Result := ''
  else
    Result := '-p' + DBPassword;
end;

function GetBrowserExe(Param: String): String;
begin
  Result := 'http://localhost/stock-control/';
end;

function ShouldImportDB: Boolean;
begin
  Result := ImportDB;
end;

// ─── Inicialización: crear páginas personalizadas ───────────────────────────

procedure InitializeWizard;
begin
  XamppDir := DetectXampp;

  // Página 1: carpeta de XAMPP (si no se detectó automáticamente)
  XamppPage := CreateInputDirPage(
    wpSelectDir,
    'Ubicación de XAMPP',
    'Indicá dónde está instalado XAMPP en tu equipo.',
    'La instalación copiará los archivos dentro de la carpeta htdocs de XAMPP.' + #13#10 +
    'Si XAMPP está en otro disco o carpeta, modificalo acá.',
    False, ''
  );
  XamppPage.Add('Carpeta de XAMPP:');
  XamppPage.Values[0] := XamppDir;

  // Página 2: contraseña de MySQL
  DBPage := CreateInputQueryPage(
    XamppPage.ID,
    'Configuración de MySQL',
    'Ingresá los datos de conexión a MySQL.',
    'Si MySQL no tiene contraseña (instalación por defecto de XAMPP), dejá el campo vacío.'
  );
  DBPage.Add('Contraseña del usuario root de MySQL:', True);

  // Página 3: opciones de instalación
  OptionsPage := CreateInputOptionPage(
    DBPage.ID,
    'Opciones de instalación',
    'Elegí qué acciones realizar durante la instalación.',
    '',
    False, False
  );
  OptionsPage.Add('Crear/actualizar la base de datos (recomendado en instalación nueva)');
  OptionsPage.Add('Solo actualizar archivos (conserva los datos existentes)');
  OptionsPage.Values[0] := True;
  OptionsPage.Values[1] := False;
end;

// ─── Al avanzar de página: actualizar variables ──────────────────────────────

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpSelectDir then begin
    // Sincronizar el dir seleccionado con el de XAMPP
    XamppDir := XamppPage.Values[0];
    WizardForm.DirEdit.Text := XamppDir + '\htdocs\stock-control';
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  MysqlExe: String;
begin
  Result := True;

  // Validar que XAMPP existe
  if CurPageID = XamppPage.ID then begin
    XamppDir := XamppPage.Values[0];
    MysqlExe := XamppDir + '\mysql\bin\mysql.exe';
    if not FileExists(MysqlExe) then begin
      MsgBox(
        'No se encontró mysql.exe en:' + #13#10 + MysqlExe + #13#10#13#10 +
        'Verificá que la ruta de XAMPP sea correcta.',
        mbError, MB_OK
      );
      Result := False;
      Exit;
    end;
    // Actualizar la ruta de instalación
    WizardForm.DirEdit.Text := XamppDir + '\htdocs\stock-control';
  end;

  // Guardar contraseña y opción de DB
  if CurPageID = OptionsPage.ID then begin
    DBPassword := DBPage.Values[0];
    ImportDB   := OptionsPage.Values[0];
  end;
end;

// ─── Actualizar database.php con la contraseña ingresada ────────────────────

procedure UpdateDatabaseConfig;
var
  ConfigFile: String;
  Content: String;
begin
  ConfigFile := WizardDirValue + '\config\database.php';
  if not LoadStringFromFile(ConfigFile, Content) then Exit;

  // Reemplazar la contraseña en el archivo de configuración
  StringChangeEx(Content,
    'define(''DB_PASS'', '''');',
    'define(''DB_PASS'', ''' + DBPassword + ''');',
    True
  );
  SaveStringToFile(ConfigFile, Content, False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    UpdateDatabaseConfig;
  end;
end;

// ─── Mensaje de éxito al finalizar ──────────────────────────────────────────

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo,
  MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
var
  S: String;
begin
  S := '';
  S := S + 'Carpeta de instalación:' + NewLine + Space + WizardDirValue + NewLine + NewLine;
  S := S + 'Carpeta de XAMPP:' + NewLine + Space + XamppDir + NewLine + NewLine;
  if ImportDB then
    S := S + 'Base de datos: Se creará/actualizará' + NewLine
  else
    S := S + 'Base de datos: Se omitirá (solo archivos)' + NewLine;
  Result := S;
end;
