import * as React from "react"

const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024
const TV_BREAKPOINT = 1920

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => { setIsMobile(window.innerWidth < MOBILE_BREAKPOINT) }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

export function useDeviceType(): 'mobile' | 'tablet' | 'desktop' | 'tv' {
  const [device, setDevice] = React.useState<'mobile' | 'tablet' | 'desktop' | 'tv'>('desktop')

  React.useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      if (w < MOBILE_BREAKPOINT) setDevice('mobile')
      else if (w < TABLET_BREAKPOINT) setDevice('tablet')
      else if (w >= TV_BREAKPOINT) setDevice('tv')
      else setDevice('desktop')
    }
    window.addEventListener('resize', update)
    update()
    return () => window.removeEventListener('resize', update)
  }, [])

  return device
}
