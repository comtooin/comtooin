import React, { useState } from 'react';
import {
  Container, Typography, Box, Paper, Accordion, AccordionSummary, AccordionDetails,
  Grid, Card, CardContent, Divider, Stack
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  HelpOutline as HelpIcon,
  EditNote as RequestIcon,
  Dashboard as DashboardIcon,
  CalendarMonth as CalendarIcon,
  CloudDownload as ArchiveIcon,
  Business as CustomerIcon,
  Computer as InventoryIcon,
  Receipt as QuoteIcon,
  NotificationsActive as NotificationIcon
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';

const AdminHelpPage: React.FC = () => {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const sections = [
    {
      id: 'request',
      title: '업무 기록 (요청 내역 관리)',
      icon: <RequestIcon color="primary" />,
      desc: '유지보수 거래처의 장애 접수 및 요청 사항을 기록하고 처리 단계를 실시간으로 관리합니다.',
      details: [
        '유지보수 요청이 들어오면 [글쓰기] 버튼을 눌러 거래처, 제목, 카테고리, 상세 내용 및 관련 이미지/문서를 첨부하여 등록합니다.',
        '배정된 엔지니어는 진행 상태를 [접수 ➔ 진행 중 ➔ 완료] 단계로 업데이트하여 상황을 실시간 공유합니다.',
        '필요시 다른 직원을 추가 작업자로 배정하여 협업할 수 있습니다.',
        '고객이 서명을 완료하면 처리 내역이 완료로 갱신되며 안전하게 저장됩니다.'
      ]
    },
    {
      id: 'dashboard',
      title: '대시보드 (통계 및 리포트)',
      icon: <DashboardIcon color="primary" />,
      desc: '전체 유지보수 실적과 카테고리별 장애 통계를 시각화하여 한눈에 모니터링합니다.',
      details: [
        '월별 장애 처리 완료 건수, 접수 중인 요청 수 등 전체 실적을 요약 제공합니다.',
        '자주 발생하는 장애 요인(예: 하드웨어 고장, 네트워크 문제, 소프트웨어 오류 등)을 파이 차트로 보여주어 문제 발생 트렌드를 파악하기 쉽습니다.',
        '각 거래처별 서비스 처리 소요 시간과 만족도 등의 지표를 모니터링하여 품질 관리에 활용할 수 있습니다.'
      ]
    },
    {
      id: 'schedule',
      title: '스케줄 관리 (일정표)',
      icon: <CalendarIcon color="primary" />,
      desc: '엔지니어 방문 일정, 정기 점검, 긴급 출장 등의 업무 일정을 달력으로 통합 관리합니다.',
      details: [
        '정기 점검 및 예약 방문 일정을 캘린더에 직접 등록하여 팀 내에 공유합니다.',
        '각 엔지니어별로 일정이 캘린더에 표시되므로 동선이 겹치지 않게 일정을 배분할 수 있습니다.',
        '일정에 접수된 자산/요청 링크가 자동 연결되어, 방문 전 사전 정보를 쉽게 확인할 수 있습니다.'
      ]
    },
    {
      id: 'archive',
      title: '자료실 (기술 문서 아카이브)',
      icon: <ArchiveIcon color="primary" />,
      desc: '해결된 장애 사례, 장비 드라이버, 소프트웨어 매뉴얼 등을 영구 보존하여 기술 지식을 자산화합니다.',
      details: [
        '특이 장애 해결법이나 자주 쓰는 프로그램을 카테고리별로 등록하여 공유 드라이브처럼 활용합니다.',
        '새로운 엔지니어 교육 시 기존 히스토리 탐색용으로 활용하면 유용합니다.',
        '자주 사용되는 윈도우 설치 가이드, 제조사 펌웨어 등을 빠르게 검색해 다운로드할 수 있습니다.'
      ]
    },
    {
      id: 'customer',
      title: '거래처 정보 관리',
      icon: <CustomerIcon color="primary" />,
      desc: '유지보수 계약을 맺은 고객사 목록과 계약 기간, 담당자 연락처 등의 핵심 데이터를 체계적으로 관리합니다.',
      details: [
        '신규 거래처의 상호명, 주소, 주 담당자 정보(전화번호, 이메일)를 입력하여 관리 대장에 추가합니다.',
        '거래처 삭제나 수정은 관리자(Admin) 권한을 가진 사용자만 안전하게 조작할 수 있습니다.',
        '해당 거래처 클릭 시, 해당 거래처가 보유한 상세 인프라(자산) 현황 화면으로 바로 연결됩니다.'
      ]
    },
    {
      id: 'inventory',
      title: '거래처 인프라(자산) 관리',
      icon: <InventoryIcon color="primary" />,
      desc: '거래처 PC 및 서버의 하드웨어 스펙과 소프트웨어 라이선스 설치 목록을 수집하여 시각적으로 대시보드화합니다.',
      details: [
        '하드웨어 탭: 컴퓨터별 CPU, RAM, 디스크 용량, 메인보드, IP 주소 등의 정보가 기록됩니다.',
        '소프트웨어 탭: 어떤 라이선스가 언제 어디에 설치되었는지 버전을 추적합니다.',
        'CSV 대량 업로드: 당사 전용 수집 스크립트(HTA)로 추출한 엑셀(CSV) 파일을 업로드하면 한 번에 수백 대의 장비가 일괄 등록됩니다. (ANSI/EUC-KR 자동 호환)',
        'AI 분석 리포트: 장비의 노후 분포도(OS 점유율, RAM 크기 분포 등) 차트 분석 및 AI 기능을 사용하여 업그레이드 제안서를 자동으로 작성해 줍니다.'
      ]
    },
    {
      id: 'quote',
      title: '간편견적 (PDF 변환 및 템플릿)',
      icon: <QuoteIcon color="primary" />,
      desc: '쇼핑몰의 부품 텍스트를 파싱하여 빠르게 마진율을 계산하고 정식 PDF 견적서를 1분 만에 제작합니다.',
      details: [
        '텍스트 간편 입력: 컴퓨존, 조이젠 장바구니 등에서 부품 텍스트 전체를 긁어 복사한 뒤 [텍스트 견적 자동입력] 창에 넣으면 표가 자동 완성됩니다.',
        '마진율 일괄 계산: 거래처명과 기본 마진율을 입력하고 [적용] 버튼을 누르면 마진과 세액이 한 번에 자동 계산됩니다.',
        '견적 템플릿 저장: 자주 쓰는 세트(예: 사무용 기본형, 게이밍 고급형 등)는 템플릿으로 저장하고 원클릭으로 불러올 수 있습니다. (사전 내용 미리보기 및 템플릿 삭제 기능 포함)',
        '모바일 PDF 원클릭 다운로드: 스마트폰 화면에 맞춰 레이아웃이 찌그러지거나 잘리지 않도록 A4 맞춤형 오프스크린 렌더링을 지원하여 완벽한 견적서 PDF를 다운로드할 수 있습니다.'
      ]
    },
    {
      id: 'notification',
      title: '실시간 푸시 알림',
      icon: <NotificationIcon color="primary" />,
      desc: '컴투인 ITSM은 OneSignal 시스템을 도입하여 팀원들에게 중요 이벤트를 즉각 알립니다.',
      details: [
        '신규 유지보수 요청건이 등록되거나, 나에게 현장 방문 일정이 배정될 때 PC 브라우저 및 스마트폰에 실시간 푸시 팝업이 전송됩니다.',
        '최초 로그인 시 브라우저 상단에서 요청하는 [알림 권한]을 반드시 "허용"해 두어야 정상 작동합니다.',
        '프로필 페이지에서 알림 설정을 켜고 끌 수 있습니다.'
      ]
    }
  ];

  return (
    <Container maxWidth="lg">
      <Helmet><title>시스템 도움말 | COMTOOIN</title></Helmet>

      {/* 헤더 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <HelpIcon sx={{ fontSize: '2.2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            시스템 도움말 및 사용 가이드
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          컴투인 IT 서비스 관리(ITSM) 플랫폼의 주요 기능과 직원용 사용 팁을 제공합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* 바로가기 그리드 카드 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {sections.map((sec) => (
          <Grid item xs={12} sm={6} md={3} key={sec.id}>
            <Card 
              variant="outlined" 
              sx={{ 
                height: '100%', 
                cursor: 'pointer', 
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  transform: 'translateY(-3px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }
              }}
              onClick={() => setExpanded(expanded === sec.id ? false : sec.id)}
            >
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                  {sec.icon}
                  <Typography variant="subtitle2" fontWeight="bold" noWrap>
                    {sec.title.split(' ')[0]}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                  {sec.desc}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 아코디언 매뉴얼 목록 */}
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
        상세 매뉴얼
      </Typography>
      
      <Box sx={{ mb: 5 }}>
        {sections.map((sec) => (
          <Accordion 
            key={sec.id} 
            expanded={expanded === sec.id} 
            onChange={handleChange(sec.id)}
            variant="outlined"
            sx={{ 
              mb: 1.5, 
              borderRadius: '8px !important',
              '&:before': { display: 'none' },
              borderColor: expanded === sec.id ? 'primary.main' : 'divider'
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={2} alignItems="center">
                {sec.icon}
                <Typography fontWeight="bold" sx={{ fontSize: '0.95rem' }}>
                  {sec.title}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ px: { xs: 2, sm: 4 }, pb: 3, pt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, bgcolor: '#f8fafc', p: 2, borderRadius: 1, borderLeft: '3px solid', borderColor: 'primary.light' }}>
                {sec.desc}
              </Typography>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                상세 이용 절차 & 팁
              </Typography>
              <Stack spacing={1.2}>
                {sec.details.map((tip, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', fontSize: '0.85rem', color: 'text.primary', lineHeight: 1.5 }}>
                    <Box sx={{ mr: 1, color: 'primary.main', fontWeight: 'bold' }}>•</Box>
                    <Box>{tip}</Box>
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Container>
  );
};

export default AdminHelpPage;
