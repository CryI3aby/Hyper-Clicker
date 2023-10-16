import { Store } from "tauri-plugin-store-api";

const store = new Store(".settings.dat");

let theme: string | null = await store.get('theme');
document.getElementById('html')!.setAttribute('data-theme', theme!); 