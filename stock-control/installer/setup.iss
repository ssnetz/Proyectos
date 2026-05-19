#define AppName      "Control de Stock - Farmacia Hospital Cima"
#define AppVersion   "3.0"
#define AppPublisher "Municipalidad de Cosquin"
#define AppURL       "http://localhost/stock-control/"

[Setup]
AppId={{F3A7B2C1-D4E5-4F60-9ABC-123456789ABC}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} v{#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
DefaultDirName=C:\xampp\htdocs\stock-control
DefaultGroupName={#AppName}
AllowNoIcons=yes
OutputBaseFilename=stock-control-setup-v3
OutputDir=output
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
DisableDirPage=no
UninstallDisplayName={#AppName}
MinVersion=6.1

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Messages]
spanish.BeveledLabel={#AppName} v{#AppVersion}
spanish.WelcomeLabel1=Bienvenido al instalador de%n{#AppName}
spanish.WelcomeLabel2=Este asistente instalará la aplicación en tu equipo.%n%nAntes de continuar, asegurate de que XAMPP esté instalado y que Apache y MySQL estén corriendo.%n%nSi es una actualización, elegí "Solo actualizar archivos" para conservar los datos existentes.

[Files]
Source: "files\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "schema.sql"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{group}\Abrir {#AppName}"; Filename: "{win}\explorer.exe"; Parameters: "{#AppURL}"; IconFilename: "{win}\explorer.exe"
Name: "{group}\Panel XAMPP"; Filename: "{code:GetXamppDir}\xampp-control.exe"
Name: "{group}\Desinstalar {#AppName}"; Filename: "{uninstallexe}"

[Run]
; ── Crear base de datos ──────────────────────────────────────────────────────
Filename: "{code:GetMysqlExe}"; \
  Parameters: "-u root {code:GetPassParam} -e ""CREATE DATABASE IF NOT EXISTS stock_control CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"""; \
  StatusMsg: "Creando base de datos..."; \
  Flags: runhidden waituntilterminated; \
  Check: ShouldImportDB

; ── Importar tablas y datos completos ───────────────────────────────────────
Filename: "{code:GetMysqlExe}"; \
  Parameters: "-u root {code:GetPassParam} stock_control < ""{tmp}\schema.sql"""; \
  StatusMsg: "Importando datos (medicamentos, usuarios, dependencias)..."; \
  Flags: runhidden waituntilterminated; \
  Check: ShouldImportDB

; ── Abrir navegador al finalizar ─────────────────────────────────────────────
Filename: "{#AppURL}"; \
  Description: "Abrir {#AppName} en el navegador ahora"; \
  Flags: postinstall shellexec skipifsilent nowait

[Code]

var
  XamppPage:   TInputDirWizardPage;
  DBPage:      TInputQueryWizardPage;
  OptionsPage: TInputOptionWizardPage;
  XamppDir:    String;
  DBPassword:  String;
  ImportDB:    Boolean;

// ── Detectar XAMPP automáticamente ──────────────────────────────────────────

function DetectXampp: String;
var
  Paths: TArrayOfString;
  i: Integer;
begin
  SetArrayLength(Paths, 5);
  Paths[0] := 'C:\xampp';
  Paths[1] := 'C:\XAMPP';
  Paths[2] := 'D:\xampp';
  Paths[3] := 'E:\xampp';
  Paths[4] := ExpandConstant('{pf}\xampp');

  for i := 0 to GetArrayLength(Paths) - 1 do begin
    if DirExists(Paths[i]) and FileExists(Paths[i] + '\mysql\bin\mysql.exe') then begin
      Result := Paths[i];
      Exit;
    end;
  end;
  Result := 'C:\xampp';
end;

// ── Getters para comandos ────────────────────────────────────────────────────

function GetMysqlExe(Param: String): String;
begin
  Result := XamppDir + '\mysql\bin\mysql.exe';
end;

function GetXamppDir(Param: String): String;
begin
  Result := XamppDir;
end;

function GetPassParam(Param: String): String;
begin
  if DBPassword = '' then
    Result := ''
  else
    Result := '-p' + DBPassword;
end;

function ShouldImportDB: Boolean;
begin
  Result := ImportDB;
end;

// ── Crear páginas personalizadas ─────────────────────────────────────────────

procedure InitializeWizard;
begin
  XamppDir := DetectXampp;

  // Página 1: carpeta de XAMPP
  XamppPage := CreateInputDirPage(
    wpSelectDir,
    'Ubicación de XAMPP',
    'Indicá dónde está instalado XAMPP en tu equipo.',
    'El instalador detectó la ruta de XAMPP automáticamente.' + #13#10 +
    'Si XAMPP está en otra unidad o carpeta, modificala acá.',
    False, ''
  );
  XamppPage.Add('Carpeta de XAMPP:');
  XamppPage.Values[0] := XamppDir;

  // Página 2: contraseña de MySQL
  DBPage := CreateInputQueryPage(
    XamppPage.ID,
    'Configuración de MySQL',
    'Datos de conexión a la base de datos.',
    'En XAMPP la instalación por defecto no tiene contraseña.' + #13#10 +
    'Dejá el campo vacío si nunca configuraste una.'
  );
  DBPage.Add('Contraseña del usuario root de MySQL:', True);

  // Página 3: tipo de instalación
  OptionsPage := CreateInputOptionPage(
    DBPage.ID,
    'Tipo de instalación',
    'Elegí qué hacer con la base de datos.',
    '',
    False, False
  );
  OptionsPage.Add('Instalación nueva: crear base de datos con todos los medicamentos (recomendado)');
  OptionsPage.Add('Actualización: solo reemplazar archivos, conservar datos existentes');
  OptionsPage.Values[0] := True;
  OptionsPage.Values[1] := False;
end;

// ── Validar al avanzar ───────────────────────────────────────────────────────

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpSelectDir then begin
    XamppDir := XamppPage.Values[0];
    WizardForm.DirEdit.Text := XamppDir + '\htdocs\stock-control';
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  MysqlExe, ApacheExe: String;
begin
  Result := True;

  if CurPageID = XamppPage.ID then begin
    XamppDir := XamppPage.Values[0];
    MysqlExe := XamppDir + '\mysql\bin\mysql.exe';
    ApacheExe := XamppDir + '\apache\bin\httpd.exe';

    if not FileExists(MysqlExe) then begin
      MsgBox(
        'No se encontró MySQL en:' + #13#10 + MysqlExe + #13#10#13#10 +
        'Verificá que la ruta de XAMPP sea correcta y que XAMPP esté instalado.',
        mbError, MB_OK
      );
      Result := False;
      Exit;
    end;

    WizardForm.DirEdit.Text := XamppDir + '\htdocs\stock-control';
  end;

  if CurPageID = OptionsPage.ID then begin
    DBPassword := DBPage.Values[0];
    ImportDB   := OptionsPage.Values[0];
  end;
end;

// ── Actualizar database.php con la contraseña ingresada ─────────────────────

procedure UpdateDatabaseConfig;
var
  ConfigFile, Content: String;
begin
  ConfigFile := WizardDirValue + '\config\database.php';
  if not LoadStringFromFile(ConfigFile, Content) then Exit;
  StringChangeEx(Content,
    'define(''DB_PASS'', '''');',
    'define(''DB_PASS'', ''' + DBPassword + ''');',
    True
  );
  SaveStringToFile(ConfigFile, Content, False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    UpdateDatabaseConfig;
end;

// ── Resumen antes de instalar ────────────────────────────────────────────────

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo,
  MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
var
  S: String;
begin
  S := 'Carpeta de instalación:' + NewLine + Space + WizardDirValue + NewLine + NewLine;
  S := S + 'XAMPP detectado en:' + NewLine + Space + XamppDir + NewLine + NewLine;
  if ImportDB then
    S := S + 'Base de datos: instalación nueva (se importarán todos los medicamentos)' + NewLine
  else
    S := S + 'Base de datos: solo actualización de archivos (datos conservados)' + NewLine;
  S := S + NewLine + 'Usuario admin: admin  /  Contraseña: password' + NewLine;
  S := S + 'Usuario operador: operador  /  Contraseña: password' + NewLine;
  Result := S;
end;
