<script setup lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { listen } from "@tauri-apps/api/event";
    import { Store, load } from '@tauri-apps/plugin-store';
    import { ref, reactive, onMounted, onUnmounted, watch } from 'vue';
    import { Icon } from "@iconify/vue";

    import Button from 'primevue/button';
    import Checkbox from 'primevue/checkbox';
    import InputNumber from 'primevue/inputnumber';
    import FloatLabel from 'primevue/floatlabel';
    import Select from 'primevue/select';
    import RadioButton from 'primevue/radiobutton';
    import Tag from 'primevue/tag';
    import Dialog from 'primevue/dialog';

    let store: Store | null = null;

    const timings = reactive({
        hours: null,
        minutes: null,
        secs: null,
        millisecs: null,
        offset: null,
        offsetState: false
    });

    const mouseButton = ref([
        { name: 'Left', id: 1 },
        { name: 'Right', id: 2 },
        { name: 'Middle', id: 3 }
    ]);

    const clickType = ref([
        { name: 'Single', id: 1 },
        { name: 'Double', id: 2 }
    ]);

    const coords = reactive<{
        x: number | null
        y: number | null
    }>({
        x: null,
        y: null
    });

    const selectedMouseButton = ref(mouseButton.value[0]);
    const selectedClickType = ref(clickType.value[0]);

    const repeatMode = ref('repeatUntil');
    const repeatCount= ref<number | null>(null);
    const lockAtMode = ref(false);
    const lockAtPopped = ref(false);
    const hotkeyChangePopped = ref(false);

    const hotkeyLabel = ref('')
    const shortcut = ref('Shift+F6');

    const saveButton = ref<'disabled' | 'enabled'>('disabled');

    const isRunning = ref(false);

    const minimalTime: number = 1;

    const settingsToWatch = [
        timings,
        selectedMouseButton,
        selectedClickType,
        () => repeatMode.value,
        () => repeatCount.value,
        lockAtMode,
        coords
    ];

    interface SavedConfig {
        timings: typeof timings;
        selectedMouseButton: typeof selectedMouseButton.value;
        selectedClickType: typeof selectedClickType.value;
        repeatMode: string;
        repeatCount: number | null;
        lockAtMode: boolean;
        coords: typeof coords;
        saveButtonState: 'disabled' | 'enabled';
    }

    let unlistenConfig: (() => void) | null = null;
    let unlistenStopped: (() => void) | null = null;

    onMounted(async () => {
        await loadSettings();

        unlistenConfig = await listen("request-config", async () => {
            await sendConfig();
            isRunning.value = true;
            await invoke("start_engine");
        });

        unlistenStopped = await listen("engine-stopped", () => {
            isRunning.value = false;
        });
    });

    onUnmounted(() => {
        unlistenConfig?.();
        unlistenStopped?.();
    });


    async function loadSettings() {
        store = await load('settings.json', { autoSave: true, defaults: {} });

        const savedHotkey = await store.get<string>('hotkey');
        if (savedHotkey) {
            shortcut.value = savedHotkey;
        } else {
            shortcut.value = 'Shift+F6';
        }

        await invoke("unregister_current_hotkey");
        await invoke("update_hotkey", { hotkey: shortcut.value });

        const saved = await store.get<SavedConfig>('config');

        if (saved && saved.saveButtonState === 'enabled') {
            Object.assign(timings, saved.timings);
            selectedMouseButton.value = saved.selectedMouseButton;
            selectedClickType.value = saved.selectedClickType;
            repeatMode.value = saved.repeatMode;
            repeatCount.value = saved.repeatCount;
            lockAtMode.value = saved.lockAtMode;
            Object.assign(coords, saved.coords);
            saveButton.value = 'enabled';
        } else {
            clearTimings();
            repeatMode.value = 'repeatUntil';
            repeatCount.value = null;
            coords.x = null;
            coords.y = null;
            saveButton.value = 'disabled';

            await saveSettings();
        }
    }

    async function saveSettings() {
        if (!store) return;

        const data = {
            timings: { ...timings },
            selectedMouseButton: selectedMouseButton.value,
            selectedClickType: selectedClickType.value,
            repeatMode: repeatMode.value,
            repeatCount: repeatCount.value,
            lockAtMode: lockAtMode.value,
            coords: { ...coords },
            saveButtonState: saveButton.value
        };

        await store!.set('config', data);
        await store.set('hotkey', shortcut.value);
        await store.save();
    }

    async function saveToggle() {
        saveButton.value = saveButton.value === 'disabled' ? 'enabled' : 'disabled';
        await saveSettings();
    }

    async function hardSave(field: string, event: any) {
        const newValue = event.value;

        if (field in timings) {
            (timings as any)[field] = newValue;
        } else if (field === 'repeatCount') {
            repeatCount.value = newValue;
        } else if (field === 'x' || field === 'y') {
            coords[field as 'x' | 'y'] = newValue;
        }
    }

    function clearTimings() {
        timings.hours = null
        timings.minutes = null
        timings.secs = null
        timings.millisecs = null
        timings.offset = null
        timings.offsetState = false
    };


    async function sendConfig() {
        const cHours = Math.abs(timings.hours || 0) * 3600000;
        const cMinutes = Math.abs(timings.minutes || 0) * 60000;
        const cSecs = Math.abs(timings.secs || 0) * 1000;
        const cMillisecs = Math.abs(timings.millisecs || 0);

        let totalTime = cHours + cMinutes + cSecs + cMillisecs;

        if (totalTime < minimalTime) {
            totalTime = minimalTime;
        }

        await invoke("send_config", {
            config: {
                interval_ms: totalTime,
                offset_ms: timings.offset ?? 0,
                offset_enabled: timings.offsetState,

                button_type: selectedMouseButton.value.name,
                click_type: selectedClickType.value.name,

                is_infinite: repeatMode.value === "repeatUntil",
                click_count: Math.abs(repeatCount.value ?? 0),

                lock_at_enabled: lockAtMode.value,
                x: coords.x ?? 0,
                y: coords.y ?? 0,
            }
        });
    }


    async function startButton() {
        isRunning.value = true;
        await sendConfig();
        await invoke("start_engine");
    }

    async function stopButton() {
        isRunning.value = false;
        await invoke("stop_engine");
    }

    async function lockAt() {
        lockAtPopped.value = true;
        const pos: number[] = await invoke<[number, number]>("get_mouse_pos");
        lockAtPopped.value = false;
        coords.x = pos[0];
        coords.y = pos[1];
    }

    async function hotkeyChange() {
        if (isRunning.value) await stopButton();

        hotkeyLabel.value = '...';
        hotkeyChangePopped.value = true;

        const unlisten = await listen<string>('hotkey-tick', (event) => {
            hotkeyLabel.value = event.payload.replace(/\+/g, ' + ');
        });

        try {
            await invoke("unregister_current_hotkey");
            const newKey = await invoke<string>("capture_hotkey");

            if (newKey) {
                shortcut.value = newKey;

                if (store) {
                    await store.set('hotkey', newKey);
                    await store.save();
                }
                await invoke("update_hotkey", { hotkey: newKey });
            }
        } finally {
            unlisten();
            hotkeyChangePopped.value = false;
        }
    }

    watch(settingsToWatch, async () => {
        if (isRunning.value) {
            await stopButton();
        }
        saveSettings();
        await sendConfig();
    }, { deep: true });

</script>

<template>
    <div class="flex flex-col gap-2 p-2 h-screen">
        <div id="timings" class="bg-[#080808]/65 p-2 rounded-sm">
            <div class="grid grid-cols-4 gap-2">
                <FloatLabel variant="on" fluid>
                    <InputNumber v-model="timings.hours" @input="(e) => hardSave('hours', e)" :useGrouping="false" size="small" fluid />
                    <label for="on_label" class="text-xs">Hours</label>
                </FloatLabel>
                <FloatLabel variant="on" fluid>
                    <InputNumber v-model="timings.minutes" @input="(e) => hardSave('minutes', e)" :useGrouping="false" size="small" fluid />
                    <label for="on_label" class="text-xs">Minutes</label>
                </FloatLabel>
                <FloatLabel variant="on" fluid>
                    <InputNumber v-model="timings.secs" @input="(e) => hardSave('secs', e)" :useGrouping="false" size="small" fluid />
                    <label for="on_label" class="text-xs">Seconds</label>
                </FloatLabel>
                <FloatLabel variant="on" fluid>
                    <InputNumber v-model="timings.millisecs" @input="(e) => hardSave('millisecs', e)" :useGrouping="false" size="small" fluid />
                    <label for="on_label" class="text-xs">Milliseconds</label>
                </FloatLabel>
            </div>

            <div class="grid grid-cols-4 pt-2 gap-2">
                <FloatLabel variant="on" fluid>
                    <InputNumber v-model="timings.offset" @input="(e) => hardSave('offset', e)" :useGrouping="false" size="small" fluid />
                    <label for="on_label" class="text-xs">Offset (ms)</label>
                </FloatLabel>
                <label class="text-sm content-center text-[#A1A1AA]">± Random Offset</label>
                <div class="flex items-center col-span-2 gap-2">
                    <Checkbox v-model="timings.offsetState" binary variant="filled"/>
                    <Button id="clearButton" size="small" variant="outlined" label="Clear" severity="secondary" @click="clearTimings" fluid/>
                </div>
            </div>
        </div>

        <div id="clickMode" class="flex gap-2">
            <div class="bg-[#080808]/65 p-2 grid flex-1 grid-rows-2 gap-1 rounded-sm">
                <div class="grid grid-cols-2 pl-1">
                    <div class="content-center">
                        <p class="text-sm">Mouse Button:</p>
                    </div>
                    <Select v-model="selectedMouseButton" :options="mouseButton" optionLabel="name" size="small" class="w-full" />
                </div>
                <div class="grid grid-cols-2 pl-1">
                    <div class="content-center">
                        <p class="text-sm my-auto">Click Type:</p>
                    </div>
                    <Select v-model="selectedClickType" :options="clickType" optionLabel="name" size="small" class="w-full" />
                </div>
            </div>

            <div class="bg-[#080808]/65 p-2 grid grid-cols-2 grid-rows-2 gap-1 flex-1 rounded-sm">
                <div class="flex items-center col-span-2 gap-2">
                    <RadioButton v-model="repeatMode" inputId="repeatUntil" value="repeatUntil"/>
                    <label for="repeatTimes" class="text-sm">Repeat Until Stopped</label>
                </div>
                <div class="flex items-center gap-2 col-span-2">
                    <RadioButton v-model="repeatMode" inputId="repeatTimes" value="repeatTimes"/>
                    <p class="text-sm">Repeat</p>
                    <FloatLabel variant="on" fluid>
                        <InputNumber v-model="repeatCount" @input="(e) => hardSave('repeatCount', e)" :min="1" inputId="withoutgrouping on_label" :useGrouping="false" size="small" fluid/>
                        <label for="on_label" class="text-xs">Times</label>
                    </FloatLabel>
                </div>
            </div>
        </div>

        <div id="locationMode" class="bg-[#080808]/65 p-2 grid grid-cols-12 gap-2 rounded-sm">
            <RadioButton class="place-self-center" v-model="lockAtMode" :value="false" size="large"/>
            <p class="col-span-3 gap-2 text-sm place-self-center col-span-2">Current Location</p>

            <div class="flex flex-row gap-2 col-start-6 col-span-7">
                <RadioButton class="place-self-center" v-model="lockAtMode" :value="true" size="large"/>
                <Dialog v-model:visible="lockAtPopped" :draggable="false" modal :closable="false" :style="{ width: '65%' }">
                    <template #header>
                        <div class="flex justify-center w-full my-[-4px]">
                            <p class="text-lg font-bold" >Lock At</p>
                        </div>
                    </template>
                    <p class="text-center text-[#707070]">Press <Tag class="text-sm">Enter</Tag> at the desired location</p>
                </Dialog>
                <FloatLabel variant="on" fluid>
                    <InputNumber v-model="coords.x" @input="(e) => hardSave('x', e)" inputId="withoutgrouping on_label" :useGrouping="false" size="small" fluid />
                    <label for="on_label" class="text-xs">X</label>
                </FloatLabel>
                <FloatLabel variant="on" fluid>
                    <InputNumber v-model="coords.y" @input="(e) => hardSave('y', e)" inputId="withoutgrouping on_label" :useGrouping="false" size="small" fluid />
                    <label for="on_label" class="text-xs ">Y</label>
                </FloatLabel>
                <Button @click="lockAt" size="small" variant="outlined" label="Lock At" severity="secondary" fluid/>
            </div>
        </div>

        <div id="buttons" class="bg-[#080808]/65 p-2 grid grid-cols-11 gap-2 rounded-sm">
            <Button class="col-span-3 text-lg" @click="startButton" label="Start" :severity="!isRunning ? 'primary' : 'secondary'" :disabled="isRunning"/>
            <Button class="col-span-3 text-lg" @click="stopButton" label="Stop" :severity="isRunning ? 'danger' : 'secondary'" :disabled="!isRunning"/>
            <Button class="col-span-3" @click="hotkeyChange" severity="secondary" variant="outlined" >
                <div class="flex flex-col items-center gap-1 ">
                    <span class="font-medium text-sm">Hotkey</span>
                    <Tag class="px-[5px]">{{ shortcut }}</Tag>
                </div>
            </Button>
            <Button class="col-span-2 gap-1" @click="saveToggle" severity="secondary" variant="outlined">
                <div class="flex flex-col items-center gap-1">
                    <Icon icon="fluent:save-32-regular" width="24" height="24" />
                    <Tag
                        :value="saveButton === 'disabled' ? 'OFF' : 'ON'"
                        :severity="saveButton === 'disabled' ? 'secondary' : 'success'"
                    ></Tag>
                </div>
            </Button>
            <Dialog v-model:visible="hotkeyChangePopped" class="content-center" :draggable="false" modal :closable="false" :style="{ width: '50%' }">
                <template #header>
                    <div class="flex justify-center w-full">
                        <p class="text-lg font-bold">Recording...</p>
                    </div>
                </template>
                <div class="flex justify-center pb-6">
                    <Tag class="text-lg">{{ hotkeyLabel || '...' }}</Tag>
                </div>
                <p class="flex justify-center text-[#707070]">Modifiers: Ctrl/Shift/Alt</p>
            </Dialog>
        </div>
    </div>
</template>

<style>
    @import "tailwindcss";
    @import "tailwindcss-primeui";

    html, body {
      height: 100%;
    }
    :root {
        background-color:rgba(16, 16, 16, 97%);
        color: #f6f6f6;
    }

    .p-floatlabel {
        --p-floatlabel-color: #424242;
    }

    .p-tag {
        --p-tag-font-size: 11px;
    }
</style>
