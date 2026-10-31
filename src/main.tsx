import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { HashRouter } from 'react-router-dom';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './app.css';
import App from './App';

const theme = createTheme({
  primaryColor: 'dark',
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  defaultRadius: 'sm',
  components: {
    Table: { defaultProps: { verticalSpacing: 6, horizontalSpacing: 'sm', fz: 'sm' } },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <ModalsProvider labels={{ confirm: 'Aceptar', cancel: 'Cancelar' }}>
        <Notifications position="top-right" />
        <HashRouter>
          <App />
        </HashRouter>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>,
);
