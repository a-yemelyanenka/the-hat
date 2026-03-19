import { useCallback, useEffect, useState } from 'react'
import type { Route } from '../appModels'

function getRoute(pathname: string): Route {
  if (pathname === '/create-room') {
    return { name: 'create-room' }
  }

  const joinMatch = pathname.match(/^\/join\/([^/]+)\/?$/)
  if (joinMatch) {
    return { name: 'join-room', inviteCode: joinMatch[1] }
  }

  const lobbyMatch = pathname.match(/^\/rooms\/([^/]+)\/lobby\/?$/)
  if (lobbyMatch) {
    return { name: 'lobby', roomId: lobbyMatch[1] }
  }

  return { name: 'home' }
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => getRoute(window.location.pathname))

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getRoute(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((nextPath: string) => {
    window.history.pushState({}, '', nextPath)
    setRoute(getRoute(nextPath))
  }, [])

  return { route, navigate }
}
