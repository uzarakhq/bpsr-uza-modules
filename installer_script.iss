[Setup]
AppName=BPSR Module Optimizer
AppVersion=1.0
AppPublisher=MrSnake
DefaultDirName={autopf}\BPSR Module Optimizer
DefaultGroupName=BPSR Module Optimizer
AllowNoIcons=yes
LicenseFile=LICENSE
OutputDir=Output
OutputBaseFilename=BPSR Module Optimizer Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SourceDir=D:\proyectos programacion\AutoModuleEN
UninstallDisplayIcon={app}\gui_app.exe
PrivilegesRequired=admin
DisableProgramGroupPage=yes

[Files]
Source: "build\exe.win-amd64-3.10\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "npcap-1.83.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{autoprograms}\BPSR Module Optimizer"; Filename: "{app}\gui_app.exe"; IconFilename: "{app}\icon.ico"
Name: "{autodesktop}\BPSR Module Optimizer"; Filename: "{app}\gui_app.exe"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Run]
Filename: "{tmp}\npcap-1.83.exe"; Parameters: ""; StatusMsg: "Por favor, sigue el asistente para instalar Npcap (requerido para la captura de paquetes)..."; Flags: waituntilterminated
