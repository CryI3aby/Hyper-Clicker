import { invoke } from "@tauri-apps/api/tauri";
import { register, unregisterAll } from '@tauri-apps/api/globalShortcut';
import { appWindow, WebviewWindow } from "@tauri-apps/api/window";
import { Store } from "tauri-plugin-store-api";
import { clearInterval, clearTimeout, setInterval, setTimeout } from 'worker-timers';

const store = new Store(".settings.dat");

window.addEventListener("DOMContentLoaded", () => {
    appWindow.show();
    document.addEventListener('contextmenu', event => event.preventDefault());
    unregisterAll();
});

window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.key == 'F5' || event.key == 'F7' || event.key == "F12" || event.key == "Enter") {
      event.preventDefault();
    }
});

let theme: string | null = await store.get('theme');
let hotkey: string | null = await store.get('hotkey');
let clickingState: string = "Off";

if (theme == null) {
    store.set('theme', 'dark');
    theme = await store.get('theme');
    document.getElementById('html')!.setAttribute('data-theme', 'dark'); 
} 
document.getElementById('html')!.setAttribute('data-theme', theme!); 

if (hotkey == null) {
    store.set('hotkey', 'F6');
    hotkey = await store.get('hotkey');
}

await register(hotkey!, () => {
    if (clickingState == 'Off') {  
        clickStart();
    }
    else {     
        clickStop();
    }
}); 

const clearButton = document.getElementById('clearButton');
const pickButton = document.getElementById('pickButton');
const startButton = document.getElementById('startButton');
const startKey = document.getElementById('startKey');
const stopButton = document.getElementById('stopButton');
const stopKey = document.getElementById('stopKey');
const hotkeyButton = document.getElementById('hotkeyButton');
const themeButton = document.getElementById('themeButton');

const xCoord = document.getElementById('xCoord');
const yCoord = document.getElementById('yCoord');

clearButton!.addEventListener('click', clickClear);
pickButton!.addEventListener('click', clickPick);
startButton!.addEventListener('click', clickStart);
stopButton!.addEventListener("click", clickStop);
hotkeyButton!.addEventListener("click", hotkeySwitch)
themeButton!.addEventListener("click", themeSwitch)

let interval = null;
let timeout = null;

startKey!.innerHTML = "" + hotkey;
stopKey!.innerHTML = "" + hotkey;

function clickClear() {
    (document.getElementById('Millisecs') as HTMLInputElement).value = "";
    (document.getElementById('Secs') as HTMLInputElement).value = "";
    (document.getElementById('Mins') as HTMLInputElement).value = "";
    (document.getElementById('Hours') as HTMLInputElement).value = "";
    (document.getElementById('rndOffsetMillisecs') as HTMLInputElement).value = "";
}

function clickPick() {
    appWindow.minimize();
    const webview = new WebviewWindow('theUniqueLabel', {
        title: 'Pick',
        url: '/nested/position.html',
        visible: false,
        resizable: false,
        fullscreen: false,
        center: true,
        height: 85,
        width: 190,
        closable: false,
        alwaysOnTop: true,
        minimizable: false
    })
    webview.once('tauri://created', function () {
        webview.show();
        unregisterAll();
        register("P", async () => {
            invoke('mouse_pos').then((coords:any) => {
                let cursorPos: Array<any> = coords;
                let x = cursorPos[0];
                let y = cursorPos[1];
                (xCoord as HTMLInputElement).value = x;
                (yCoord as HTMLInputElement).value = y;
            });
            webview.close();
            unregisterAll();
            appWindow.setFocus();
            appWindow.show();
            let hotcock: string | null = await store.get('hotkey');
            register(hotcock!, () => {
                if (clickingState == 'Off') {  
                    clickStart();
                }
                else {      
                    clickStop();
                }
            }); 
        })
    })
};

function clickStart() {
    const millisecs = (document.getElementById('Millisecs') as HTMLInputElement).value;
    const secs = (document.getElementById('Secs') as HTMLInputElement).value;
    const mins = (document.getElementById('Mins') as HTMLInputElement).value;
    const hours = (document.getElementById('Hours') as HTMLInputElement).value;

    let offsetState: string;
    const offsetTime = (document.getElementById('rndOffsetMillisecs') as HTMLInputElement).value;

    const mouseButton = (document.getElementById('mouseButton') as HTMLInputElement).value;
    const clickType = (document.getElementById('clickType') as HTMLInputElement).value;

    let repeatMode: string;
    const repeatCount = +(document.getElementById('limitedCount') as HTMLInputElement).value;

    let positionMode: string;
    let posX = +(document.getElementById('xCoord') as HTMLInputElement).value;
    let posY = +(document.getElementById('yCoord') as HTMLInputElement).value;

    document.getElementById('hotkeyButton')!.innerHTML = "Hotkey";

    let tms;
    if (millisecs == "" && secs =="" && mins =="" && hours =="") {
        tms = 3;
    } 
    else {
        tms = +millisecs;
    }
    const tsecs = +secs * 1000 ?? 0;
    const tmins = +mins * 60000 ?? 0;
    const thours = +hours * 3600000 ?? 0;

    let sum;
    sum = +tms + +tsecs + +tmins + +thours

    if ((document.getElementById('rndOffset') as HTMLInputElement).checked == true) {
        offsetState = "On";
    }
    else {
        offsetState = "Off";
    }

    if ((document.getElementById('infiniteRepeat') as HTMLInputElement).checked == true) {
        (document.getElementById('limitedRepeat') as HTMLInputElement).disabled = true;   
        repeatMode = "Infinite";
    }
    else {
        (document.getElementById('infiniteRepeat') as HTMLInputElement).disabled = true;
        repeatMode = "Limited";
    }

    if ((document.getElementById('currentLocation') as HTMLInputElement).checked == true) {
        (document.getElementById('pickedLocation') as HTMLInputElement).disabled = true;   
        positionMode = "Current";
    }
    else {
        (document.getElementById('currentLocation') as HTMLInputElement).disabled = true; 
        positionMode = "Picked";
    }

    let count: number = 0;

    let operators = [{
        sign: "+",
        method: function(a: number, b: number) { return a + b; }
    },{
        sign: "-",
        method: function(a: number, b: number) { return a - b; }
    }];
    let selectedOperator = Math.floor(Math.random()*operators.length);

    clickingState = 'On';

    function CLICK() {
        if (clickingState == "On") {
            if (positionMode == "Current") {
                switch (mouseButton) {
                    case 'Left':				
                        if (clickType == "Single")
                        {
                            invoke('single_left');
                            break;
                        }
                        else {
                            invoke('double_left');
                            break;
                        }			
                        case 'Middle':
                        if (clickType == "Single")
                        {
                            invoke('single_middle');
                            break;
                        }
                        else {
                            invoke('double_middle');
                            break;
                        }			
                        case 'Right':
                        if (clickType == "Single")
                        {
                            invoke('single_right');
                            break;
                        }
                        else {
                            invoke('double_right');
                            break;
                        }		
                }
            }
            else {
                if (posX != 0 && posY != 0)
                {
                    switch (mouseButton) {
                        case 'Left':		                            	
                            if (clickType == "Single")
                            {
                                invoke('set_pos', {xpos: posX, ypos: posY});
                                invoke('single_left');
                                break;
                            }
                            else {
                                invoke('set_pos', {xpos: posX, ypos: posY});
                                invoke('double_left');
                                break;
                            }			
                            case 'Middle':
                            if (clickType == "Single")
                            {
                                invoke('set_pos', {xpos: posX, ypos: posY});
                                invoke('single_middle');
                                break;
                            }
                            else {
                                invoke('set_pos', {xpos: posX, ypos: posY});
                                invoke('double_middle');
                                break;
                            }			
                            case 'Right':
                            if (clickType == "Single")
                            {
                                invoke('set_pos', {xpos: posX, ypos: posY});
                                invoke('single_right');
                                break;
                            }
                            else {
                                invoke('set_pos', {xpos: posX, ypos: posY});
                                invoke('double_right');
                                break;
                            }		
                    }
                }
                else {
                    return;
                }
            }
        }
    };

    disableInterface();

    if (positionMode == "Picked") {
        if (posX == 0 && posY == 0) {
            clickStop();
        }
        else {
            if (repeatMode == "Limited") {
                if(repeatCount <= 0 ) {
                    clickStop();
                }
                if (repeatCount == 1) {
                    CLICK(); 
                    clickStop();
                }
                if (repeatCount > 1) {
                    CLICK();
        
                    if (offsetState == "On") {
                        (function loop() {
                            let offsetSum = operators[selectedOperator].method(sum, Math.floor(Math.random() * +offsetTime) + 1)
                            if (count != repeatCount - 1) {
                                timeout = setTimeout(() => {
                                    CLICK();
                                    count++;
                                    loop();
                                }, offsetSum);
                            }
                            else {
                                clickStop();
                            }
                        })();
                    }
                    else {
                        interval = setInterval(async () => {
                            CLICK();  
                            count++;
                            if (count == repeatCount - 1) {
                                clickStop();	
                            }	
                        }, sum);	
                    }
                }
            }
            else {
                CLICK(); 
        
                if (offsetState == "On") {
                    (function loop() {
                        let offsetSum = operators[selectedOperator].method(sum, Math.floor(Math.random() * +offsetTime) + 1)
                        timeout = setTimeout(() => {
                            CLICK(); 
                            loop();
                        }, offsetSum);
                    })();
                }
                else {
                    interval = setInterval(async () => {
                        CLICK(); 
                    }, sum);
                }
            }
        }
    }
    else {
        if (repeatMode == "Limited") {
            if(repeatCount <= 0 ) {
                clickStop();
            }
            if (repeatCount == 1) {
                CLICK();
                clickStop();
            }
            if (repeatCount > 1) {
                CLICK(); 
    
                if (offsetState == "On") {
                    (function loop() {
                        let offsetSum = operators[selectedOperator].method(sum, Math.floor(Math.random() * +offsetTime) + 1)
                        if (count != repeatCount - 1) {
                            timeout = setTimeout(() => {
                                CLICK(); 
                                count++;
                                loop();
                            }, offsetSum);
                        }
                        else {
                            clickStop();
                        }
                    })();
                }
                else {
                    interval = setInterval(async () => {
                        CLICK(); 
                        count++;
                        if (count == repeatCount - 1) {
                            clickStop();	
                        }	
                    }, sum);	
                }
            }
        }
        else {
            CLICK(); 
    
            if (offsetState == "On") {
                (function loop() {
                    let offsetSum = operators[selectedOperator].method(sum, Math.floor(Math.random() * +offsetTime) + 1)
                    timeout = setTimeout(() => {
                        CLICK(); 
                        loop();
                    }, offsetSum);
                })();
            }
            else {
                interval = setInterval(async () => {
                    CLICK(); 
                }, sum);
            }
        }
    }
};

function clickStop() {
    clickingState = 'Off';

    if (interval! != null)
    {
        clearInterval(interval!);
    }
    if (timeout! != null) {
        clearTimeout(timeout!);
    }

    (document.getElementById('Hours') as HTMLInputElement).disabled = false;
    (document.getElementById('Mins') as HTMLInputElement).disabled = false;
    (document.getElementById('Secs') as HTMLInputElement).disabled = false;
    (document.getElementById('Millisecs') as HTMLInputElement).disabled = false;
    (document.getElementById('clearButton') as HTMLInputElement).disabled = false;

    (document.getElementById('rndOffsetMillisecs') as HTMLInputElement).disabled = false;
    (document.getElementById('rndOffset') as HTMLElement).setAttribute('onclick', '');
    (document.getElementById('rndOffset') as HTMLInputElement).disabled = false;

    (document.getElementById('mouseButton') as HTMLInputElement).disabled = false;
    (document.getElementById('clickType') as HTMLInputElement).disabled = false;

    (document.getElementById('limitedRepeat') as HTMLInputElement).disabled = false;
    (document.getElementById('limitedCount') as HTMLInputElement).disabled = false;
    (document.getElementById('infiniteRepeat') as HTMLInputElement).disabled = false;

    (document.getElementById('currentLocation') as HTMLInputElement).disabled = false;
    (document.getElementById('pickedLocation') as HTMLInputElement).disabled = false;
    (document.getElementById('pickButton') as HTMLInputElement).disabled = false;
    (document.getElementById('xCoord') as HTMLInputElement).disabled = false;
    (document.getElementById('yCoord') as HTMLInputElement).disabled = false;

    (document.getElementById('startButton') as HTMLInputElement).disabled = false;
    (document.getElementById('stopButton') as HTMLInputElement).disabled = true;   
    (document.getElementById('hotkeyButton') as HTMLInputElement).disabled = false;
    (document.getElementById('themeButton') as HTMLInputElement).disabled = false; 
};

function hotkeySwitch() {
    document.getElementById('hotkeyButton')!.innerHTML = "Press the key";
    unregisterAll();
    document.addEventListener('keydown', async (e) => {
        let key = e.key;
        if (key == "Shift" || key == "Control" || key == "Alt" || key == "\\" || key == "Meta") {
            document.getElementById('hotkeyButton')!.innerHTML = "Bad Key";
            let oldhotkey: string | null = await store.get('hotkey');
            register(oldhotkey!, () => {
                if (clickingState == 'Off') {  
                    clickStart();
                }
                else {      
                    clickStop();
                }
            }); 
            store.save();
        }
        else {
            document.getElementById('startKey')!.innerHTML = "" + key;
            document.getElementById('stopKey')!.innerHTML = "" + key;
            document.getElementById('hotkeyButton')!.innerHTML = "Hotkey";
            store.set('hotkey', key);
            unregisterAll();
            register(key, () => {
                if (clickingState == 'Off') {  
                    clickStart();
                }
                else {      
                    clickStop();
                }
            }); 
            store.save();
        }
    }, {once : true});
};

function themeSwitch() {
    if (document.getElementById('html')!.getAttribute('data-theme') == 'dark') {
        document.getElementById('html')!.setAttribute('data-theme', 'light'); 
        store.set('theme', "light");
    }
    else {
        document.getElementById('html')!.setAttribute('data-theme', 'dark'); 
        store.set('theme', "dark");
    }
} 

function disableInterface() {
    (document.getElementById('Hours') as HTMLInputElement).disabled = true;
    (document.getElementById('Mins') as HTMLInputElement).disabled = true;
    (document.getElementById('Secs') as HTMLInputElement).disabled = true;
    (document.getElementById('Millisecs') as HTMLInputElement).disabled = true;
    (document.getElementById('clearButton') as HTMLInputElement).disabled = true;

    (document.getElementById('rndOffsetMillisecs') as HTMLInputElement).disabled = true;
    
    if ((document.getElementById('rndOffset') as HTMLInputElement).checked == true) {
        (document.getElementById('rndOffset') as HTMLElement).setAttribute('onclick', 'return false');
    }
    else {
        (document.getElementById('rndOffset') as HTMLInputElement).disabled = true;
    }
    
    (document.getElementById('mouseButton') as HTMLInputElement).disabled = true;
    (document.getElementById('clickType') as HTMLInputElement).disabled = true;

    (document.getElementById('limitedCount') as HTMLInputElement).disabled = true;

    (document.getElementById('pickButton') as HTMLInputElement).disabled = true;
    (document.getElementById('xCoord') as HTMLInputElement).disabled = true;
    (document.getElementById('yCoord') as HTMLInputElement).disabled = true;

    (document.getElementById('startButton') as HTMLInputElement).disabled = true;
    (document.getElementById('stopButton') as HTMLInputElement).disabled = false;
    (document.getElementById('hotkeyButton') as HTMLInputElement).disabled = true;
    (document.getElementById('themeButton') as HTMLInputElement).disabled = true; 
}

