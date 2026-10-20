<#
  ppro-uia.ps1 - automacao do que a API UXP do Premiere nao expoe.

  MEDIDO na maquina alvo (Premiere Pro 2026), nao suposto:
    - O UIAutomation NAO enxerga menu nenhum: MenuBar 0, Menu 0, MenuItem 0.
      A UI e toda "DroverLord", custom da Adobe.
    - MAS existe um menu nativo Win32 (GetMenu), e postar WM_COMMAND com o ID
      do item FUNCIONA. E o caminho usado aqui: sem mouse, sem coordenada,
      sem depender de timing de animacao.
    - O Premiere so aceita o WM_COMMAND quando E a janela ativa. Na pratica
      isso vale, porque o clique vem de um painel dentro do proprio Premiere.
    - Os dialogos sao #32770 (classe padrao do Windows), mas o CONTEUDO deles
      nao e exposto ao UIA: o de Preferences mostra 10 Panes, so os campos
      numericos. Por isso nada aqui tenta ler ou marcar controle de dialogo.

  IDs de menu (extraidos do menu nativo desta versao):
    11431  Edit > Remove Unused
    11432  Edit > Consolidate Duplicates
    11630  Sequence > Delete Tracks...
    57642  Edit > Select All
    57634  Edit > Copy
    57637  Edit > Paste

  Saida: sempre uma linha JSON: { ok, data, error }.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('consolidate', 'removeunused', 'tracks', 'calibrate-tracks',
               'copyall', 'paste', 'probe')]
  [string]$Task,

  # tracks: sequencia gravada, em FRACAO do tamanho do dialogo.
  # Formato "fx_fy;fx_fy;..." - ver Format-Pair / Parse-Pair.
  [string]$Clicks = '',

  # tamanho do dialogo na hora da calibracao, para conferir a proporcao
  [int]$CalW = 0,
  [int]$CalH = 0
)

$ErrorActionPreference = 'Stop'

Add-Type @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class PT {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, int e);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int k);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();

  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }

  // SetForegroundWindow sozinho e bloqueado pelo Windows quando quem chama nao
  // esta em primeiro plano - e o console do .bat rouba o foco ao abrir.
  // Anexando a fila de input do thread dono da janela em foco, o bloqueio cai.
  public static void ForceForeground(IntPtr h) {
    IntPtr fg = GetForegroundWindow();
    if (fg == h) return;
    uint dummy;
    uint tFg = GetWindowThreadProcessId(fg, out dummy);
    uint tMe = GetCurrentThreadId();
    if (tFg != tMe) AttachThreadInput(tMe, tFg, true);
    BringWindowToTop(h);
    SetForegroundWindow(h);
    if (tFg != tMe) AttachThreadInput(tMe, tFg, false);
  }

  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    System.Threading.Thread.Sleep(80);
    mouse_event(0x02, 0, 0, 0, 0);   // LEFTDOWN
    System.Threading.Thread.Sleep(40);
    mouse_event(0x04, 0, 0, 0, 0);   // LEFTUP
  }

  public static List<IntPtr> Dialogs(uint want) {
    var res = new List<IntPtr>();
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid != want || !IsWindowVisible(h)) return true;
      var c = new StringBuilder(64); GetClassNameW(h, c, 64);
      if (c.ToString() == "#32770") res.Add(h);
      return true;
    }, IntPtr.Zero);
    return res;
  }
  public static string Txt(IntPtr h) {
    var s = new StringBuilder(512); GetWindowTextW(h, s, 512); return s.ToString();
  }
}
'@

$WM_COMMAND = 0x0111
$WM_CLOSE   = 0x0010

function Out-Result($ok, $data, $err) {
  ([ordered]@{ ok = [bool]$ok; data = $data; error = $err } |
    ConvertTo-Json -Depth 10 -Compress)
}

function Get-Premiere {
  $p = Get-Process |
       Where-Object { $_.ProcessName -like 'Adobe Premiere Pro*' -and $_.MainWindowHandle -ne 0 } |
       Select-Object -First 1
  if (-not $p) { throw 'Premiere Pro is not running.' }
  return $p
}

function Invoke-MenuId($proc, [int]$id) {
  # O Premiere so aceita WM_COMMAND quando e a janela ativa, e o console do
  # .bat rouba o foco ao abrir - por isso o ForceForeground.
  [PT]::ForceForeground($proc.MainWindowHandle)
  Start-Sleep -Milliseconds 400
  [void][PT]::PostMessage($proc.MainWindowHandle, $WM_COMMAND, [IntPtr]$id, [IntPtr]::Zero)
}

function Get-Rect($h) {
  $r = New-Object PT+RECT
  [void][PT]::GetWindowRect($h, [ref]$r)
  return @{ L = $r.L; T = $r.T; W = ($r.R - $r.L); H = ($r.B - $r.T) }
}

# Espera um dialogo #32770 cujo titulo case com $needle. Devolve o hwnd ou zero.
function Wait-Dialog($proc, $needle, $timeoutSec = 8) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    foreach ($h in [PT]::Dialogs([uint32]$proc.Id)) {
      if (-not $needle -or [PT]::Txt($h) -like "*$needle*") { return $h }
    }
    Start-Sleep -Milliseconds 200
  }
  return [IntPtr]::Zero
}

# Checagem imediata, sem espera. NAO usar Wait-Dialog com timeout 0: o laco
# dela e "while (now < now+0)", que nunca executa e sempre devolve "nao achei".
function Test-Dialog($proc, $needle) {
  foreach ($h in [PT]::Dialogs([uint32]$proc.Id)) {
    if (-not $needle -or [PT]::Txt($h) -like "*$needle*") { return $h }
  }
  return [IntPtr]::Zero
}

# Deteccao de clique por BORDA DE SUBIDA usando o bit 0x8000 ("o botao esta
# pressionado agora").
#
# NAO usar o bit 0x1 ("foi pressionado desde a ultima chamada"): esse bit e
# estado GLOBAL do sistema, e qualquer outro processo que chame
# GetAsyncKeyState o consome. Medido na pratica: 914 leituras em 14 segundos
# durante os quais o usuario clicou 4 vezes, e ZERO cliques detectados.
# Comparando o estado atual com o anterior, ninguem pode nos roubar o evento.
$script:mouseWasDown = $false

function Test-MouseDown {
  return (([PT]::GetAsyncKeyState(0x01) -band 0x8000) -ne 0)
}

# Zera a referencia de borda com o estado atual, para que um botao ainda
# pressionado nao vire um clique fantasma na proxima leitura.
function Reset-ClickEdge {
  $script:mouseWasDown = Test-MouseDown
}

function Read-Click {
  $down = Test-MouseDown
  $isEdge = ($down -and -not $script:mouseWasDown)
  $script:mouseWasDown = $down
  if (-not $isEdge) { return $null }
  $p = New-Object PT+POINT
  [void][PT]::GetCursorPos([ref]$p)
  return $p
}

# O Windows do usuario esta em pt-BR, onde "{0:F4}" produz "0,1399" - a
# virgula decimal colidia com o separador de campos e o parser descartava
# todos os cliques. Numero SEMPRE em cultura invariante, e o par separado por
# "_", que nunca aparece num numero.
$INV = [System.Globalization.CultureInfo]::InvariantCulture

function Format-Pair([double]$x, [double]$y) {
  return $x.ToString('F4', $INV) + '_' + $y.ToString('F4', $INV)
}

function Parse-Pair([string]$pair) {
  $xy = $pair -split '_'
  if ($xy.Count -ne 2) { return $null }
  return @([double]::Parse($xy[0], $INV), [double]::Parse($xy[1], $INV))
}

function Close-Dialog($h) {
  if ($h -ne [IntPtr]::Zero) {
    [void][PT]::SendMessage($h, $WM_CLOSE, [IntPtr]::Zero, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 400
  }
}

# =====================================================================
try {
  $proc = Get-Premiere

  switch ($Task) {

    'consolidate' {
      # Sem dialogo: o comando age direto no projeto.
      Invoke-MenuId $proc 11432
      Start-Sleep -Milliseconds 700
      Out-Result $true 'Consolidate Duplicates executed.' $null
    }

    'removeunused' {
      Invoke-MenuId $proc 11431
      Start-Sleep -Milliseconds 700
      Out-Result $true 'Remove Unused executed.' $null
    }

    'copyall' {
      # Select All + Copy na TIMELINE. O foco importa: se o Project panel
      # estiver ativo, o Select All seleciona itens do bin e o Copy copia a
      # coisa errada. Quem chama e responsavel por abrir a sequencia antes
      # (openSequence da foco a timeline).
      Invoke-MenuId $proc 57642
      Start-Sleep -Milliseconds 350
      Invoke-MenuId $proc 57634
      Start-Sleep -Milliseconds 550
      Out-Result $true 'Select All + Copy sent.' $null
    }

    'paste' {
      Invoke-MenuId $proc 57637
      Start-Sleep -Milliseconds 800
      Out-Result $true 'Paste sent.' $null
    }

    'calibrate-tracks' {
      # Abre Delete Tracks e GRAVA os seus cliques dentro dele, ate a janela
      # fechar (o seu clique no OK encerra a gravacao). Cada posicao vira uma
      # FRACAO do tamanho do dialogo, nao pixels: assim continua valendo se a
      # escala de DPI mudar. Gravar a sequencia inteira, em vez de fixar
      # "3 checkboxes + OK", cobre tambem os dropdowns caso venham errados.
      Invoke-MenuId $proc 11630
      $dlg = Wait-Dialog $proc 'Delete Tracks' 10
      if ($dlg -eq [IntPtr]::Zero) {
        Out-Result $false $null 'Delete Tracks dialog did not open. Is a sequence open?'
        break
      }
      $rc = Get-Rect $dlg
      if ($rc.W -le 0 -or $rc.H -le 0) {
        Out-Result $false $null 'Could not measure the dialog.'
        break
      }

      # Lista tipada, nao array com +=: a contagem precisa ser confiavel.
      # $recorded, NAO $clicks: as variaveis do PowerShell sao
      # case-insensitive e $clicks colidiria com o parametro [string]$Clicks,
      # herdando a restricao de tipo e virando String de volta.
      $recorded = New-Object System.Collections.Generic.List[string]
      $ignored = 0

      # Espera o botao ser SOLTO antes de comecar. O clique que acionou a
      # calibracao (no icone do painel) pode ainda estar pressionado; contar
      # com uma janela morta fixa comia justamente o seu primeiro checkbox.
      $waitUp = (Get-Date).AddSeconds(3)
      while ((Test-MouseDown) -and (Get-Date) -lt $waitUp) {
        Start-Sleep -Milliseconds 10
      }
      Reset-ClickEdge


      # Fim da gravacao = o HANDLE do dialogo virar invalido. Antes eu varria
      # todas as janelas do sistema comparando titulos a cada 30ms: caro e
      # sujeito a falhar por um instante, encerrando a gravacao no meio.
      # IsWindow olha o handle que ja temos, e nao mente.
      $closedAt = $null
      $polls = 0
      $startedAt = Get-Date
      $endedBy = 'timeout'
      $deadline = (Get-Date).AddSeconds(120)

      while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 15
        $polls++

        $p = Read-Click
        if ($p) {
          # so conta clique DENTRO do dialogo: qualquer coisa fora e ruido
          if ($p.X -ge $rc.L -and $p.X -le ($rc.L + $rc.W) -and
              $p.Y -ge $rc.T -and $p.Y -le ($rc.T + $rc.H)) {
            $recorded.Add((Format-Pair (($p.X - $rc.L) / $rc.W) (($p.Y - $rc.T) / $rc.H)))
          } else {
            $ignored++
          }
          # sem debounce: uma borda de subida dispara uma vez por pressionada,
          # e dormir aqui so criaria uma janela para perder o clique seguinte
        }

        if (-not [PT]::IsWindow($dlg)) {
          # O clique que FECHOU o dialogo (o OK) costuma estar pendente neste
          # exato instante. Sair aqui perderia justamente o clique mais
          # importante - por isso a tolerancia antes de encerrar.
          if ($null -eq $closedAt) { $closedAt = Get-Date }
          elseif (((Get-Date) - $closedAt).TotalMilliseconds -gt 1200) {
            $endedBy = 'closed'
            break
          }
        } else {
          $closedAt = $null
        }
      }
      $elapsed = [int]((Get-Date) - $startedAt).TotalMilliseconds

      if ([PT]::IsWindow($dlg)) {
        Close-Dialog $dlg
        Out-Result $false $null ('Timed out with the dialog still open; ' +
          $recorded.Count + ' clicks captured. Finish with OK next time.')
        break
      }
      if ($recorded.Count -lt 2) {
        Out-Result $false $null ('Only ' + $recorded.Count +
          ' click(s) captured inside the dialog, ' + $ignored + ' outside. ' +
          'Captured: [' + ($recorded -join ' ') + ']. ' +
          'Ended by ' + $endedBy + ' after ' + $elapsed + 'ms / ' + $polls + ' polls.')
        break
      }
      Out-Result $true ([ordered]@{
        w = $rc.W; h = $rc.H; count = $recorded.Count; clicks = ($recorded -join ';')
      }) $null
    }

    'tracks' {
      # O conteudo do dialogo nao e exposto ao UIAutomation (medido: um unico
      # filho, OS_ViewContainer opaco), entao nao da para marcar os checkboxes
      # por API. Reproduzimos a sequencia gravada na calibracao.
      if (-not $Clicks) {
        # Diagnostico junto: se a calibracao existe mas o argumento chegou
        # vazio, o problema esta na ponte painel -> .bat, nao na calibracao.
        Out-Result $false $null (
          'No click sequence received (Clicks empty, CalW=' + $CalW +
          ', CalH=' + $CalH + '). Recalibrate with the target icon.')
        break
      }

      Invoke-MenuId $proc 11630
      $dlg = Wait-Dialog $proc 'Delete Tracks' 10
      if ($dlg -eq [IntPtr]::Zero) {
        Out-Result $false $null 'Delete Tracks dialog did not open. Is a sequence open?'
        break
      }
      $rc = Get-Rect $dlg

      # proporcao diferente da calibracao = layout ou escala mudou; clicar
      # seria chutar no escuro.
      if ($CalW -gt 0 -and $CalH -gt 0) {
        $rCal = [double]$CalW / [double]$CalH
        $rNow = [double]$rc.W / [double]$rc.H
        if ([Math]::Abs($rCal - $rNow) -gt 0.02) {
          Close-Dialog $dlg
          Out-Result $false $null (
            'Dialog shape changed since calibration (' + $CalW + 'x' + $CalH +
            ' -> ' + $rc.W + 'x' + $rc.H + '). Recalibrate.')
          break
        }
      }

      Start-Sleep -Milliseconds 450
      $done = 0
      foreach ($pair in ($Clicks -split ';')) {
        if (-not $pair) { continue }
        $xy = Parse-Pair $pair
        if ($null -eq $xy) { continue }
        [PT]::Click([int]($rc.L + $xy[0] * $rc.W), [int]($rc.T + $xy[1] * $rc.H))
        $done++
        Start-Sleep -Milliseconds 220
      }
      if ($done -eq 0) {
        Close-Dialog (Test-Dialog $proc 'Delete Tracks')
        Out-Result $false $null ('Could not read the recorded clicks: [' + $Clicks + ']. Recalibrate.')
        break
      }
      Start-Sleep -Milliseconds 700

      $still = Wait-Dialog $proc 'Delete Tracks' 1
      if ($still -ne [IntPtr]::Zero) {
        Close-Dialog $still
        Out-Result $false $null 'The dialog stayed open, so the final click missed. Nothing was changed; recalibrate.'
      } else {
        Out-Result $true 'Empty tracks deleted.' $null
      }
    }

    'probe' {
      # Diagnostico: itens de topo do menu nativo + dialogos abertos.
      Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class PTM {
  [DllImport("user32.dll")] public static extern IntPtr GetMenu(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetMenuItemCount(IntPtr m);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int GetMenuStringW(IntPtr m, uint id, StringBuilder s, int n, uint f);
}
'@
      $out = [ordered]@{ menus = @(); dialogs = @() }
      $hMenu = [PTM]::GetMenu($proc.MainWindowHandle)
      if ($hMenu -ne [IntPtr]::Zero) {
        $n = [PTM]::GetMenuItemCount($hMenu)
        for ($i = 0; $i -lt $n; $i++) {
          $sb = New-Object System.Text.StringBuilder 256
          [void][PTM]::GetMenuStringW($hMenu, [uint32]$i, $sb, 256, 0x400)
          $out.menus += ($sb.ToString() -replace '&', '')
        }
      }
      foreach ($h in [PT]::Dialogs([uint32]$proc.Id)) { $out.dialogs += [PT]::Txt($h) }
      Out-Result $true $out $null
    }
  }
}
catch {
  Out-Result $false $null $_.Exception.Message
}
