import { Outlet } from 'react-router-dom'
import { AccessesTabs } from './AccessesTabs'

export function AccessesLayout() {
  return (
    <div className="space-y-6">
      <AccessesTabs />
      <Outlet />
    </div>
  )
}
