import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'
import { authOptions } from '@/lib/auth'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 })
    }

    const { currentPassword, newPassword } = await req.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: '새 비밀번호는 8자 이상이어야 합니다.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    const passwordMatch = await bcryptjs.compare(currentPassword, user.password)
    
    if (!passwordMatch) {
      return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 })
    }

    const hashedNewPassword = await bcryptjs.hash(newPassword, 12)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedNewPassword,
        isFirstLogin: false,
        mustChangePassword: false,
        updatedAt: new Date()
      }
    })

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'password_change',
        resource: 'user',
        details: { username: user.username },
        success: true
      }
    })

    return NextResponse.json({ 
      message: '비밀번호가 성공적으로 변경되었습니다.',
      success: true 
    })
  } catch (error) {
    console.error('Password change error:', error)
    return NextResponse.json({ error: '비밀번호 변경 중 오류가 발생했습니다.' }, { status: 500 })
  }
}