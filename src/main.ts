import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { LazyStore } from '@tauri-apps/plugin-store';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { clearInterval, clearTimeout, setInterval} from 'worker-timers';


window.addEventListener("DOMContentLoaded", () => {
  setupWindow()
});


//#region Initialization
async function setupWindow() {
  const tauriWindow = getCurrentWindow();

  tauriWindow.show();
  document.addEventListener('contextmenu', event => event.preventDefault());

  unregisterAll();
  
  window.addEventListener('keydown', (event) => {
    if (event.key == 'F3' || event.key == 'F5' || event.key == 'F7' || event.key == "F12" || event.key == "Enter") {
      event.preventDefault();
    }
    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
  }
  });

  tauriWindow.onCloseRequested(() => {
    if (document.getElementById('saveButton')!.getAttribute('class') == 'btn btn-success btn-dash') {
      Save()
    };
    tauriWindow.destroy();
  });
}

const savedSettings = new LazyStore('settings.json');

if (await savedSettings.get('theme') == null) {
  await savedSettings.set('theme', 'dark');
  await savedSettings.set('hotkey', 'F6');
  await savedSettings.set('save', false);
};

let theme: string | undefined = await savedSettings.get('theme');
let hotkey: string | undefined = await savedSettings.get('hotkey');
let save: boolean | undefined = await savedSettings.get('save');

await register(hotkey!, (event) => {
  if (event.state === 'Pressed') {
    Engine();
  }
});

let hours: string | undefined = (await savedSettings.get<{ hours: string }>('timing'))?.hours;
let mins: string | undefined = (await savedSettings.get<{ minutes: string }>('timing'))?.minutes;
let secs: string | undefined = (await savedSettings.get<{ seconds: string }>('timing'))?.seconds;
let millisecs: string | undefined = (await savedSettings.get<{ milliseconds: string }>('timing'))?.milliseconds;
let offset_state: boolean | undefined = (await savedSettings.get<{ offset_state: boolean }>('timing'))?.offset_state;
let offset: string | undefined = (await savedSettings.get<{ offset: string }>('timing'))?.offset;

let mouseButton: string | undefined = (await savedSettings.get<{ mouse_button: string }>('click_mode'))?.mouse_button;
let clickType: string | undefined = (await savedSettings.get<{ type: string }>('click_mode'))?.type;

let limitedRepeat: boolean | undefined = (await savedSettings.get<{ limited: boolean }>('repeat_mode'))?.limited;
let repeatCount: string | undefined = (await savedSettings.get<{ count: string }>('repeat_mode'))?.count;

let pickedLocation: boolean | undefined = (await savedSettings.get<{ picked: boolean }>('position'))?.picked;
let xCoord: string | undefined = (await savedSettings.get<{ x_coord: string }>('position'))?.x_coord;
let yCoord: string | undefined = (await savedSettings.get<{ y_coord: string }>('position'))?.y_coord;

let isRunning: boolean = false;
let interval: number;
let timeout: number;

let operators = [{
  sign: "+",
  method: function(a: number, b: number) { return a + b; }
},{
  sign: "-",
  method: function(a: number, b: number) { return a - b; }
}];

let selectedOperator = Math.floor(Math.random()*operators.length);

const minimalTime: number = 1;
let totalTime: number = 0;
let repeatedTimes: number = 0;

document.getElementById('html')!.setAttribute('data-theme', theme!); 

if (save == true) {
  if (hours != "0") {
    (document.getElementById('Hours') as HTMLInputElement).value = hours!;
  }
  if (mins != "0") {
    (document.getElementById('Mins') as HTMLInputElement).value = mins!;
  }
  if (secs != "0") {
    (document.getElementById('Secs') as HTMLInputElement).value = secs!;
  }
  if (millisecs != "0") {
    (document.getElementById('Millisecs') as HTMLInputElement).value = millisecs!;
  }


  if (offset_state == true) {
    (document.getElementById('OffsetCheckbox') as HTMLInputElement).checked = true;
  }

  if (offset != "0") {
    (document.getElementById('Offset') as HTMLInputElement).value = offset!;
  }


  (document.getElementById('mouseButton') as HTMLInputElement).value = mouseButton!;
  (document.getElementById('clickType') as HTMLInputElement).value = clickType!;


  if (limitedRepeat == true) {
    (document.getElementById('limitedRepeat') as HTMLInputElement).checked = true;
  }

  if (repeatCount != "0") {
    (document.getElementById('limitedCount') as HTMLInputElement).value = repeatCount!;
  }


  if (pickedLocation == true) {
    (document.getElementById('pickedLocation') as HTMLInputElement).checked = true;
  }
  if (xCoord != "0") {
    (document.getElementById('xCoord') as HTMLInputElement).value = xCoord!;
  }
  if (yCoord != "0") {
    (document.getElementById('yCoord') as HTMLInputElement).value = yCoord!;
  }


  document.getElementById('saveButton')!.setAttribute('class', 'btn btn-success btn-dash'); 
}

document.getElementById('startButton')!.innerHTML = "Start (" + hotkey + ")";
document.getElementById('stopButton')!.innerHTML = "Stop (" + hotkey + ")";

document.getElementById('clearButton')!.addEventListener('click', ClearAll);
document.getElementById('pickButton')!.addEventListener('click', PickButton)
document.getElementById('startButton')!.addEventListener('click', Engine);
document.getElementById('stopButton')!.addEventListener('click', Stop);
document.getElementById('themeButton')!.addEventListener('click', ThemeSwitch);
document.getElementById('hotkeyButton')!.addEventListener('click', HotkeyChange);
document.getElementById('saveButton')!.addEventListener('click', SaveSwitch);
//#endregion




function GetSettings() {
  const inputHours = +(document.getElementById('Hours') as HTMLInputElement).value;
  const inputMins = +(document.getElementById('Mins') as HTMLInputElement).value;
  const inputSecs = +(document.getElementById('Secs') as HTMLInputElement).value;
  const inputMillisecs = +(document.getElementById('Millisecs') as HTMLInputElement).value;

  const offsetState = (document.getElementById('OffsetCheckbox') as HTMLInputElement).checked;
  const inputOffset = +(document.getElementById('Offset') as HTMLInputElement).value;

  const mouseButton = +(document.getElementById('mouseButton') as HTMLInputElement).value;
  const clickType = +(document.getElementById('clickType') as HTMLInputElement).value;

  const limitedRepeat = (document.getElementById('limitedRepeat') as HTMLInputElement).checked;
  const repeatCount = +(document.getElementById('limitedCount') as HTMLInputElement).value;

  const pickedLocation = (document.getElementById('pickedLocation') as HTMLInputElement).checked;
  const inputXCoord = +(document.getElementById('xCoord') as HTMLInputElement).value;
  const inputYCoord = +(document.getElementById('yCoord') as HTMLInputElement).value;

  return {
    inputHours, inputMins, inputSecs, inputMillisecs, offsetState, inputOffset, 
    mouseButton, clickType,
    limitedRepeat, repeatCount,
    pickedLocation, inputXCoord, inputYCoord
  }
}

function Engine() {
  if (isRunning === false) {
    
    (document.getElementById('startButton') as HTMLInputElement).disabled = true;
    (document.getElementById('stopButton') as HTMLInputElement).disabled = false;

    const settings = GetSettings();
    repeatedTimes = 0;

    const cHours = +settings.inputHours* 3600000 ;
    const cMins = +settings.inputMins * 60000;
    const cSecs = +settings.inputSecs * 1000;
    const cMillisecs = +settings.inputMillisecs;

    if (settings.inputHours == 0 && settings.inputMins == 0 && settings.inputSecs == 0 && settings.inputMillisecs == 0) {
      totalTime = minimalTime;
    } 
    else {
      totalTime = cHours + cMins + cSecs + cMillisecs;
    }

    isRunning = true;

    if (settings.limitedRepeat === true && settings.repeatCount == 0) { isRunning = false; return; }
    invoke('click', {
      mouseButton: settings.mouseButton,
      clickType: settings.clickType,
      picked: settings.pickedLocation,
      xCoord: settings.inputXCoord ?? 0, 
      yCoord: settings.inputYCoord ?? 0
    });
    repeatedTimes++;
    if (settings.limitedRepeat === true && settings.repeatCount == 1) { isRunning = false; return; }



    if (settings.offsetState === true) {
      (function loop() {
        if (!isRunning) return;

        let offsetSum = operators[selectedOperator].method(totalTime, Math.floor(Math.random() * + settings.inputOffset) + 1);

        timeout = setTimeout(() => {
          if (!isRunning) return;

          invoke('click', {
            mouseButton: settings.mouseButton,
            clickType: settings.clickType,
            picked: settings.pickedLocation,
            xCoord: settings.inputXCoord ?? 0, 
            yCoord: settings.inputYCoord ?? 0
          });

          if (settings.limitedRepeat === true) {
            repeatedTimes++;
        
            if (repeatedTimes == settings.repeatCount) {
              Stop();
              return;
            }
          }
    
          loop();

        }, offsetSum);
      })();
    }
    else {
      interval = setInterval(() => {

        if (settings.limitedRepeat === true) {
          repeatedTimes++;
  
          if (repeatedTimes == settings.repeatCount) {
            Stop()
          }
        }
  
        invoke('click', {
          mouseButton: settings.mouseButton,
          clickType: settings.clickType,
          picked: settings.pickedLocation,
          xCoord: settings.inputXCoord ?? 0, 
          yCoord: settings.inputYCoord ?? 0
        });
        
        }, totalTime);
      }
    }
  else {
    Stop();
  }
}

function Stop() {
  isRunning = false;
  clearTimeout(timeout);
  clearInterval(interval);

  (document.getElementById('startButton') as HTMLInputElement).disabled = false;
  (document.getElementById('stopButton') as HTMLInputElement).disabled = true;
}




function ClearAll() {
  document.querySelectorAll<HTMLInputElement>("#timings input").forEach(el => {
    if (el instanceof HTMLInputElement) {
        if (el.type === "checkbox" || el.type === "radio") {
            el.checked = false;
        } else {
            el.value = "";
        }
    }
});
}

async function PickButton() {
  document.getElementById('locationOverlay')!.classList.replace("hidden", "flex");
  const pos: number[] = await invoke("get_mouse_pos");
  (document.getElementById('pickedLocation') as HTMLInputElement).checked = true;
  document.getElementById('locationOverlay')!.classList.replace("flex", "hidden");
  (document.getElementById('xCoord') as HTMLInputElement).value = pos[0].toString();
  (document.getElementById('yCoord') as HTMLInputElement).value = pos[1].toString();
}

function HotkeyChange() {
  document.getElementById("hotkeyOverlay")!.classList.replace("hidden", "flex");
  unregisterAll();

  document.addEventListener('keydown', HandleNewHotkey);
}

async function HandleNewHotkey(event: KeyboardEvent) {
  document.getElementById("hotkeyOverlay")!.classList.replace("flex", "hidden");

  savedSettings.set('hotkey', event.code);

  await register(event.code, (event) => {
    if (event.state === 'Pressed') {
      Engine();
    }
  });

  document.getElementById('startButton')!.innerHTML = "Start (" + (event.key).toUpperCase() + ")";
  document.getElementById('stopButton')!.innerHTML = "Stop (" + (event.key).toUpperCase() + ")";

  document.removeEventListener('keydown', HandleNewHotkey);

}

function ThemeSwitch() {
  if (document.getElementById('html')!.getAttribute('data-theme') == 'dark') {

    document.getElementById('html')!.setAttribute('data-theme', 'light'); 
    savedSettings.set('theme', 'light');
  }
  else {
    document.getElementById('html')!.setAttribute('data-theme', 'dark'); 
    savedSettings.set('theme', 'dark');
  }
}

async function SaveSwitch() {
  if (document.getElementById('saveButton')!.getAttribute('class') == 'btn btn-primary btn-soft') {

    document.getElementById('saveButton')!.setAttribute('class', 'btn btn-success btn-dash'); 
    await savedSettings.set('save', true) ;

    Save();
  }
  else {

    document.getElementById('saveButton')!.setAttribute('class', 'btn btn-primary btn-soft'); 
    await savedSettings.set('save', false);

    await savedSettings.delete('timing');
    await savedSettings.delete('click_mode');
    await savedSettings.delete('repeat_mode');
    await savedSettings.delete('position');
  }
}

async function Save() {
  const settings = GetSettings();

    await savedSettings.set('timing', { 
      hours: settings.inputHours, 
      minutes: settings.inputMins,
      seconds: settings.inputSecs,
      milliseconds: settings.inputMillisecs,
      offset_state: settings.offsetState,
      offset: settings.inputOffset
    });

    await savedSettings.set('click_mode', {
      mouse_button: settings.mouseButton,
      type: settings.clickType
    })

    await savedSettings.set('repeat_mode', {
      limited: settings.limitedRepeat,
      count: settings.repeatCount
    })

    await savedSettings.set('position', {
      picked: settings.pickedLocation,
      x_coord: settings.inputXCoord,
      y_coord: settings.inputYCoord
    });
}
