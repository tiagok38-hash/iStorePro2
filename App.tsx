import React, { useState, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Outlet, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar.tsx';
import Header from './components/Header.tsx';
import TopBar from './components/TopBar.tsx';
import { ToastProvider } from './contexts/ToastContext.tsx';
import { UserProvider } from './contexts/UserContext.tsx';
import { ChatProvider, useChat } from './contexts/ChatContext.tsx';

import ProtectedRoute from './components/ProtectedRoute.tsx';
import AuthLayout from './components/AuthLayout.tsx';
import { OnlineStatusIndicator, SuspenseFallback } from './components/GlobalLoading.tsx';
import BottomNav from './components/BottomNav.tsx';
import ChatLayout from './components/chat/ChatLayout.tsx';
import { useUser } from './contexts/UserContext.tsx';
import { lazyWithRetry } from './utils/lazyWithRetry.ts';

// Sincroniza o userId do usuário logado com o ChatContext (para cálculo de não lidas)
const ChatUserSync: React.FC = () => {
    const { user } = useUser();
    const { setCurrentUserId } = useChat();
    React.useEffect(() => {
        setCurrentUserId(user?.id ?? null);
    }, [user?.id, setCurrentUserId]);
    return null;
};

const Dashboard = lazyWithRetry(() => import('./pages/Dashboard.tsx'), 'Dashboard');
const Products = lazyWithRetry(() => import('./pages/Products.tsx'), 'Products');
const Customers = lazyWithRetry(() => import('./pages/Customers.tsx'), 'Customers');
const POS = lazyWithRetry(() => import('./pages/POS.tsx'), 'POS');
const Reports = lazyWithRetry(() => import('./pages/Reports.tsx'), 'Reports');
const Company = lazyWithRetry(() => import('./pages/Company.tsx'), 'Company');
const Vendas = lazyWithRetry(() => import('./pages/Vendas.tsx'), 'Vendas');
const Orcamentos = lazyWithRetry(() => import('./pages/Orcamentos.tsx'), 'Orcamentos');
const Login = lazyWithRetry(() => import('./pages/Login.tsx'), 'Login');
const ServiceOrderLayout = lazyWithRetry(() => import('./pages/ServiceOrders/ServiceOrderLayout.tsx'), 'SOLayout');
const ServiceOrderDashboard = lazyWithRetry(() => import('./pages/ServiceOrders/ServiceOrderDashboard.tsx'), 'SODashboard');
const ServiceOrderList = lazyWithRetry(() => import('./pages/ServiceOrders/ServiceOrderList.tsx'), 'SOList');
const ServiceOrderForm = lazyWithRetry(() => import('./pages/ServiceOrders/ServiceOrderForm.tsx'), 'SOForm');
const ServiceOrderProducts = lazyWithRetry(() => import('./pages/ServiceOrders/ServiceOrderProducts.tsx'), 'SOProducts');
const ServiceOrderCustomers = lazyWithRetry(() => import('./pages/ServiceOrders/ServiceOrderCustomers.tsx'), 'SOCustomers');
const ServiceOrderSettings = lazyWithRetry(() => import('./pages/ServiceOrders/ServiceOrderSettings.tsx'), 'SOSettings');
const ServiceOrderFinancial = lazyWithRetry(() => import('./pages/ServiceOrders/ServiceOrderFinancial.tsx'), 'SOFinancial');
const ServiceOrderReports = lazyWithRetry(() => import('./pages/ServiceOrders/ServiceOrderReports.tsx'), 'SOReports');
const CatalogLayout = lazyWithRetry(() => import('./pages/Catalog/CatalogLayout.tsx'), 'CatalogLayout');
const CatalogAdmin = lazyWithRetry(() => import('./pages/Catalog/CatalogAdmin.tsx'), 'CatalogAdmin');
const CatalogSettings = lazyWithRetry(() => import('./pages/Catalog/CatalogSettings.tsx'), 'CatalogSettings');
const CatalogPublic = lazyWithRetry(() => import('./pages/Catalog/CatalogPublic.tsx'), 'CatalogPublic');
const Financeiro = lazyWithRetry(() => import('./pages/Financeiro.tsx'), 'Financeiro');

const GlobalChat = () => {
    const { isChatOpen, closeChat } = useChat();
    return <ChatLayout isOpen={isChatOpen} onClose={closeChat} />;
};

const MainLayout: React.FC = () => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const location = useLocation();

    const toggleSidebarCollapse = () => {
        setIsSidebarCollapsed(prev => !prev);
    };

    return (
        <div className="flex bg-background text-primary min-h-screen">
            <Sidebar
                isOpen={false}
                isCollapsed={isSidebarCollapsed}
                toggleCollapse={toggleSidebarCollapse}
                onCloseSidebar={() => { }}
            />

            {/* Sincroniza userId com ChatContext para cálculo de não lidas */}
            <ChatUserSync />

            <div className="flex-1 flex flex-col w-full min-w-0 pb-[calc(env(safe-area-inset-bottom)+70px)] lg:pb-0">
                <Header />
                <TopBar />

                <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto">
                    <Suspense fallback={<SuspenseFallback />}>
                        <div key={location.pathname} className="animate-fade-in h-full">
                            <Outlet />
                        </div>
                    </Suspense>
                </main>
            </div>
            <BottomNav />
        </div>
    );
}

const App: React.FC = () => {
    return (
        <ToastProvider>
            <UserProvider>
                <ChatProvider>
                    <Router>
                        <Suspense fallback={<SuspenseFallback fullScreen />}>
                            <Routes>
                                {/* Public Auth Routes */}
                                <Route element={<AuthLayout />}>
                                    <Route path="/login" element={<Login />} />
                                    {/* Registro bloqueado - redireciona para login */}
                                    <Route path="/register" element={<Login />} />
                                </Route>

                                {/* Protected App Routes */}
                                <Route element={<ProtectedRoute />}>
                                    <Route element={<MainLayout />}>
                                        <Route element={<ProtectedRoute permissionKey="canAccessDashboard" />}>
                                            <Route path="/" element={<Dashboard />} />
                                        </Route>
                                        <Route element={<ProtectedRoute permissionKey="canAccessEstoque" />}>
                                            <Route path="/products" element={<Products />} />
                                        </Route>
                                        <Route element={<ProtectedRoute permissionKey="canAccessClientes" />}>
                                            <Route path="/customers" element={<Customers />} />
                                        </Route>
                                        <Route element={<ProtectedRoute permissionKey="canAccessVendas" />}>
                                            <Route path="/vendas" element={<Vendas />} />
                                        </Route>
                                        <Route element={<ProtectedRoute permissionKey="canAccessOrcamentos" />}>
                                            <Route path="/orcamentos" element={<Orcamentos />} />
                                        </Route>
                                        <Route element={<ProtectedRoute permissionKey="canAccessRelatorios" />}>
                                            <Route path="/reports" element={<Reports />} />
                                        </Route>
                                        <Route element={<ProtectedRoute permissionKey={["canAccessEmpresa", "canEditOwnProfile", "canManageMarcasECategorias"]} />}>
                                            <Route path="/company" element={<Company />} />
                                        </Route>
                                        <Route element={<ProtectedRoute permissionKey="canAccessFinanceiro" />}>
                                            <Route path="/financeiro" element={<Financeiro />} />
                                        </Route>
                                        <Route element={<ProtectedRoute permissionKey="canViewOwnCommission" />}>
                                            <Route path="/comissoes" element={<Navigate to="/company?tab=comissoes" replace />} />
                                        </Route>
                                    </Route>
                                    <Route element={<ProtectedRoute permissionKey="canAccessPOS" />}>
                                        <Route path="/pos" element={<POS />} />
                                    </Route>

                                    {/* Service Order Module (Immersive) */}
                                    <Route element={<ProtectedRoute permissionKey="canAccessDashboard" />}>
                                        <Route path="/service-orders" element={<ServiceOrderLayout />}>
                                            <Route index element={<ServiceOrderDashboard />} />
                                            <Route path="list" element={<ServiceOrderList />} />
                                            <Route path="new" element={<ServiceOrderForm />} />
                                            <Route path="edit/:id" element={<ServiceOrderForm />} />
                                            <Route path="products" element={<ServiceOrderProducts />} />
                                            <Route path="customers" element={<ServiceOrderCustomers />} />
                                            <Route path="financial" element={<ServiceOrderFinancial />} />
                                            <Route path="reports" element={<ServiceOrderReports />} />
                                            <Route path="settings" element={<ServiceOrderSettings />} />
                                        </Route>
                                    </Route>

                                    {/* Catalog Module (Immersive) */}
                                    <Route element={<ProtectedRoute permissionKey="canAccessCatalog" />}>
                                        <Route path="/catalog" element={<CatalogLayout />}>
                                            <Route index element={<CatalogAdmin />} />
                                            <Route path="settings" element={<CatalogSettings />} />
                                        </Route>
                                    </Route>
                                </Route>

                                {/* Public Catalog (No Auth Required) */}
                                <Route path="/catalogo/:slug" element={<CatalogPublic />} />
                            </Routes>
                        </Suspense>
                        {/* Global Online/Offline Status Indicator */}
                        <OnlineStatusIndicator />
                        <GlobalChat />
                    </Router>
                </ChatProvider>
            </UserProvider>
        </ToastProvider>
    );
};

export default App;