import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router.ts';
import './styles.css';

// Pinia is installed first, because the router's sign-in check uses the session store.
createApp(App).use(createPinia()).use(router).mount('#app');
