import { Route, Routes } from 'react-router-dom'
import { PublicOnly, RequireAuth } from '@/features/auth/RequireAuth'
import { RequirePermission } from '@/features/auth/RequirePermission'
import { AppLayout } from '@/features/layout/AppLayout'
import { MODULES } from '@/features/modules/registry'
import { AccountPage } from '@/pages/AccountPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PanelPage } from '@/pages/PanelPage'

function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<PanelPage />} />
          <Route path="cuenta" element={<AccountPage />} />

          {MODULES.map((module) => {
            const ModuleComponent = module.component
            return (
              <Route
                key={module.id}
                path={module.path}
                element={
                  <RequirePermission permission={module.permission}>
                    <ModuleComponent />
                  </RequirePermission>
                }
              />
            )
          })}
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
