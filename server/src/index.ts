import { createApp } from './app.js';
import { PORT, PUBLIC_BASE_URL } from './config.js';
import { getTotalCount, getTotalPages } from './store/peopleStore.js';
import { getUserCount } from './store/userStore.js';

const app = createApp();

app.listen(PORT, () => {
  console.log(`[server] ${PUBLIC_BASE_URL} — ready`);
  console.log(
    `[server] ${getTotalCount()} people loaded, ${getTotalPages()} pages of 10`,
  );
  console.log(`[server] ${String(getUserCount())} user(s) in the store`);
});
