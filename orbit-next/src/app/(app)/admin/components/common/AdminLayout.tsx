"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Header, Sidebar } from "@/components/layout";

type AdminLayoutProps = {
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  sidebarItems: any[];
  selectedView: string;
  handleSidebarClick: (id: string) => void;
  children: React.ReactNode;
};

export function AdminLayout({
  mobileSidebarOpen,
  setMobileSidebarOpen,
  sidebarItems,
  selectedView,
  handleSidebarClick,
  children,
}: AdminLayoutProps) {
  const closeMobileSidebar = () => {
    try {
      const active = document.activeElement as HTMLElement | null;
      if (active && typeof active.blur === 'function') {
        active.blur();
      }
    } catch (e) {
      // ignore
    }
    setMobileSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onMobileToggle={() => setMobileSidebarOpen(prev => !prev)} />
      <div className="flex">
        {/* Desktop sidebar (fixed) */}
        <div className="hidden md:block w-64 h-[calc(100vh-4rem)] bg-card fixed top-16 left-0 z-30 overflow-y-auto">
          <Sidebar
            items={sidebarItems}
            activeItem={selectedView}
            onItemClick={(id) => { handleSidebarClick(id); setMobileSidebarOpen(false); }}
          />
        </div>

        {/* Mobile sidebar (overlay) */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-black/50 md:hidden"
                onClick={closeMobileSidebar}
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'tween', duration: 0.3 }}
                className="fixed top-0 left-0 z-50 w-64 h-full bg-card md:hidden"
              >
                <Sidebar
                  items={sidebarItems}
                  activeItem={selectedView}
                  onItemClick={(id) => { handleSidebarClick(id); closeMobileSidebar(); }}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main content area (scrollable) */}
        <div className="min-w-0 flex-1 md:ml-64 min-h-[calc(100vh-4rem)] w-full overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
