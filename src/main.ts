import { createApp } from "vue";
import App from "./App.vue";

import PrimeVue from 'primevue/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

import { getCurrentWindow } from "@tauri-apps/api/window";

const app = createApp(App);

const MainPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '{indigo.50}',
            100: '{indigo.100}',
            200: '{indigo.200}',
            300: '{indigo.300}',
            400: '{indigo.400}',
            500: '{indigo.500}',
            600: '{indigo.600}',
            700: '{indigo.700}',
            800: '{indigo.800}',
            900: '{indigo.900}',
            950: '{indigo.950}'
        },
        colorScheme: {
            light: {
                formField: {
                    hoverBorderColor: '{primary.color}'
                }
            },
            dark: {
                formField: {
                    hoverBorderColor: '{primary.color}',
                    borderColor: '#202020',
                    background: '#0E0E0E',
                },
            },
        },
    },
});

app.use(PrimeVue, {
    theme: {
        preset: MainPreset,
        options: {
            cssLayer: {
                name: 'primevue',
                order: 'theme, base, primevue'
            }
        }
    }
});

app.mount("#app");

window.addEventListener("DOMContentLoaded", () => {
    getCurrentWindow().show();

    document.addEventListener('contextmenu', event => event.preventDefault());
    window.addEventListener('keydown', (event) => {
        if (event.key == 'F3' || event.key == 'F5' || event.key == 'F7' || event.key == "F12" ) {
            event.preventDefault();
        }
        if (event.ctrlKey && event.key === 'f') {
            event.preventDefault();
        }
    });
});
