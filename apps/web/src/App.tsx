import { Route, Routes } from 'react-router-dom'
import { PublicOnly, RequireAuth } from '@/features/auth/RequireAuth'
import { RequirePermission } from '@/features/auth/RequirePermission'
import { AppLayout } from '@/features/layout/AppLayout'
import { MODULES } from '@/features/modules/registry'
import { AccountPage } from '@/pages/AccountPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PanelPage } from '@/pages/PanelPage'
import { AccessesLayout } from '@/features/accesses/AccessesLayout'
import { AccessesQaPage } from '@/pages/AccessesQaPage'
import { AccessesQaDetailPage } from '@/pages/AccessesQaDetailPage'

const AccessesCatalogPage = MODULES.find(
  (module) => module.id === 'accesses',
)!.component

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

          <Route
            path="accesos"
            element={
              <RequirePermission permission="accesos.ver">
                <AccessesLayout />
              </RequirePermission>
            }
          >
            <Route index element={<AccessesCatalogPage />} />
            <Route path="qas" element={<AccessesQaPage />} />
            <Route path="qas/:personId" element={<AccessesQaDetailPage />} />
          </Route>

          {MODULES.filter((module) => module.id !== 'accesses').map((module) => {
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
