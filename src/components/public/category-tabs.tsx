'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from 'cn'

type Props = { categories: { slug: string; name: string }[] }

/**
 * Abas fixas no topo que levam até cada categoria e acompanham a rolagem.
 * As seções precisam ter id = slug.
 */
export function CategoryTabs({ categories }: Props) {
  const [active, setActive] = useState(categories[0]?.slug)
  const navRef = useRef<HTMLElement>(null)

  // Destaca a categoria visível no topo da tela.
  useEffect(() => {
    const sections = categories
      .map((c) => document.getElementById(c.slug))
      .filter((el): el is HTMLElement => el !== null)

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) setActive(visible[0].target.id)
      },
      { rootMargin: '-140px 0px -55% 0px' },
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [categories])

  // Mantém a aba ativa visível na barra (rolagem horizontal).
  useEffect(() => {
    const nav = navRef.current
    const tab = nav?.querySelector<HTMLElement>(`[data-slug="${active}"]`)
    if (!nav || !tab) return
    const left = tab.offsetLeft - nav.clientWidth / 2 + tab.clientWidth / 2
    nav.scrollTo({ left, behavior: 'smooth' })
  }, [active])

  return (
    <nav
      ref={navRef}
      aria-label="Categorias"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {categories.map((c) => (
        <a
          key={c.slug}
          href={`#${c.slug}`}
          data-slug={c.slug}
          aria-current={active === c.slug ? 'true' : undefined}
          onClick={() => setActive(c.slug)}
          className={cn(
            'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            active === c.slug
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-foreground hover:bg-secondary',
          )}
        >
          {c.name}
        </a>
      ))}
    </nav>
  )
}
