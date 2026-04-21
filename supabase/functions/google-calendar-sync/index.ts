import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version',
  'Access-Control-Allow-Methods': 'POST, PATCH, DELETE, OPTIONS',
}

serve(async (req) => {
  // CORS 사전 요청(Preflight) 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const { method = 'POST', googleEventId, title, description, startTime, endTime, allDay, assigneeEmail } = payload

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')?.trim()
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim()
    const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')?.trim()

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Google OAuth 환경 변수가 설정되지 않았습니다.')
    }

    // 1. 구글 액세스 토큰 갱신
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok) throw new Error(`구글 인증 실패: ${tokenData.error_description || tokenData.error}`)

    const accessToken = tokenData.access_token

    // 2. 이메일 주소 전처리 (빈 값 및 중복 제거)
    const emails = assigneeEmail 
      ? Array.from(new Set(assigneeEmail.split(',').map((e: string) => e.trim()).filter((e: string) => e !== '')))
      : []
    
    const eventBody: any = {
      summary: title,
      description: description,
      attendees: emails.map((email: string) => ({ email })),
    }

    // 3. API URL 및 메소드 결정
    let effectiveMethod = method
    let apiUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all'
    
    if (method === 'PATCH' && googleEventId) {
      apiUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}?sendUpdates=all`
    } else if (method === 'PATCH' && !googleEventId) {
      effectiveMethod = 'POST'
    }

    // 4. 날짜 처리
    if (allDay) {
      const startDay = startTime.split('T')[0]
      eventBody.start = { date: startDay }
      
      // 종료일은 시작일 다음날로 설정 (exclusive)
      const date = new Date(startDay)
      date.setDate(date.getDate() + 1)
      const endDay = date.toISOString().split('T')[0]
      eventBody.end = { date: endDay } 
    } else {
      eventBody.start = { dateTime: new Date(startTime).toISOString(), timeZone: 'Asia/Seoul' }
      const endDateTime = endTime ? new Date(endTime) : new Date(new Date(startTime).getTime() + 3600000)
      eventBody.end = { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Seoul' }
    }

    // 5. 구글 캘린더 API 호출
    const calendarResponse = await fetch(apiUrl, {
      method: effectiveMethod,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    })

    const calendarData = await calendarResponse.json()
    if (!calendarResponse.ok) {
      throw new Error(`캘린더 API 오류: ${calendarData.error?.message || JSON.stringify(calendarData)}`)
    }

    return new Response(JSON.stringify({ success: true, googleEventId: calendarData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Function Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
