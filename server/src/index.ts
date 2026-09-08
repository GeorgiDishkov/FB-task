import { createApp } from './app.js';
import { PORT, PUBLIC_BASE_URL } from './config.js';
import { getTotalCount, getTotalPages } from './store/peopleStore.js';

const app = createApp();

app.listen(PORT, () => {
  console.log(`[server] ${PUBLIC_BASE_URL} — ready`);
  console.log(
    `[server] ${getTotalCount()} people loaded, ${getTotalPages()} pages of 10`,
  );
});
