import { AppShell, NavLink, Stack, Text, Title, Loader, Center } from '@mantine/core';
import {
  IconLayoutDashboard,
  IconBriefcase,
  IconBuildingStore,
  IconArmchair,
  IconSettings,
} from '@tabler/icons-react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import Proyectos from './pages/Proyectos';
import ProyectoPage from './pages/proyecto/ProyectoPage';
import Marcas from './pages/Marcas';
import Productos from './pages/Productos';
import AjustesPage from './pages/Ajustes';
import { seedInicial } from './lib/seed';

const NAV = [
  { to: '/', label: 'Dashboard', icon: IconLayoutDashboard },
  { to: '/proyectos', label: 'Proyectos', icon: IconBriefcase },
  { to: '/marcas', label: 'Marcas', icon: IconBuildingStore },
  { to: '/productos', label: 'Productos', icon: IconArmchair },
  { to: '/ajustes', label: 'Ajustes y datos', icon: IconSettings },
];

export default function App() {
  const loc = useLocation();
  const [listo, setListo] = useState(false);
  useEffect(() => {
    seedInicial()
      .catch((e) => console.error(e))
      .finally(() => setListo(true));
  }, []);

  return (
    <AppShell navbar={{ width: 220, breakpoint: 0 }} padding="lg">
      <AppShell.Navbar p="sm">
        <Stack gap={2} mb="md" px="xs" pt="xs">
          <Title order={4}>FF&amp;E Contract</Title>
          <Text size="xs" c="dimmed">Gestión de proyectos</Text>
        </Stack>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            component={Link}
            to={n.to}
            label={n.label}
            leftSection={<n.icon size={18} stroke={1.5} />}
            active={n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to)}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        {!listo ? (
          <Center h={300}><Loader /></Center>
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/proyectos" element={<Proyectos />} />
            <Route path="/proyectos/:id/*" element={<ProyectoPage />} />
            <Route path="/marcas" element={<Marcas />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/ajustes" element={<AjustesPage />} />
          </Routes>
        )}
      </AppShell.Main>
    </AppShell>
  );
}
