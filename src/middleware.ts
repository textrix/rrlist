import { withAuth } from 'next-auth/middleware'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    if (pathname.startsWith('/auth/')) {
      if (token && pathname !== '/auth/change-password') {
        if (token.mustChangePassword || token.isFirstLogin) {
          return NextResponse.redirect(new URL('/auth/change-password', req.url))
        }
        return NextResponse.redirect(new URL('/', req.url))
      }
      return NextResponse.next()
    }

    if (token?.mustChangePassword || token?.isFirstLogin) {
      return NextResponse.redirect(new URL('/auth/change-password', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        
        if (pathname.startsWith('/auth/login')) {
          return true
        }
        
        if (pathname.startsWith('/auth/change-password')) {
          return !!token
        }
        
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}