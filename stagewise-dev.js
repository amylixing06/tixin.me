import { initToolbar } from '@stagewise/toolbar';

const stagewiseConfig = {
  plugins: []
};

if (process.env.NODE_ENV === 'development' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  initToolbar(stagewiseConfig);
}
