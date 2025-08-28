import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      username: string
      email?: string | null
      image?: string | null
      isFirstLogin: boolean
      mustChangePassword: boolean
    }
  }

  interface User {
    id: string
    username: string
    isFirstLogin: boolean
    mustChangePassword: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username: string
    isFirstLogin: boolean
    mustChangePassword: boolean
  }
}