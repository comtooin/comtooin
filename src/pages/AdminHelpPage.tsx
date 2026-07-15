import React, { useState } from 'react';
import {
  Container, Typography, Box, Accordion, AccordionSummary, AccordionDetails,
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
  AutoAwesome as AiIcon
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
      title: '업무 기록 (유지보수 일지)',
      icon: <RequestIcon color="primary" />,
      desc: '유지보수 거래처의 장애 접수 및 처리 내역을 기록하고 처리 완료 여부를 실시간으로 관리합니다.',
      details: [
        '유지보수 업무 발생 시, 업무 일자, 거래처명, 작성자, 요청자(고객 담당자), 접수내용을 필수 기재하여 [업무 기록 저장하기] 버튼으로 등록합니다.',
        '진행 상태는 [처리중 ➔ 완료] 2단계로 직접 변경할 수 있으며, 처리내용 필드에 조치 사항을 적어 저장하면 시스템이 자동으로 상태를 완료로 자동 업데이트합니다.',
        '접수내용 작성 시 더 원활한 작성을 위해 음성 인식(STT) 기능과 AI를 통한 문맥 맞춤형 텍스트 정돈 기능을 제공합니다.',
        '필요에 따라 현장 조치 상태를 증빙할 수 있는 작업 전/후 이미지(최대 5개)를 실시간으로 첨부하여 이력을 남길 수 있습니다.'
      ]
    },
    {
      id: 'dashboard',
      title: '대시보드 (통계 및 리포트)',
      icon: <DashboardIcon color="primary" />,
      desc: '등록된 전체 유지보수 실적과 거래처별 작업 점유율을 시각화된 차트로 분석 및 모니터링합니다.',
      details: [
        '전체 업무 등록 현황 요약: 등록된 전체 건수와 처리중, 완료된 건수를 상단 수치 카드로 직관적으로 요약해 줍니다.',
        '거래처별 비중 및 상태 분포: 어떤 거래처에서 업무 요청이 가장 빈번히 일어났는지 파이 차트로 작업 비중을 직관적으로 시각화합니다.',
        '월별 업무 추이: 연간 월별 데이터 건수 변화를 막대그래프로 표출하여 계절성 요인이나 유지보수 트렌드를 간편하게 예측할 수 있습니다.',
        '리포트 다운로드: 필터(거래처, 특정 월)에 맞춰 조회한 유지보수 내역 데이터를 엑셀(CSV) 파일로 원클릭 다운로드할 수 있으며, CSV 파일 업로드 시 사전 오류 데이터 검증(Validation)을 지원합니다.'
      ]
    },
    {
      id: 'schedule',
      title: '스케줄 관리 (방문 일정표)',
      icon: <CalendarIcon color="primary" />,
      desc: '엔지니어 방문 일정, 정기 점검, 긴급 출장 등의 일정을 팀 캘린더를 통해 체계적으로 통합 관리합니다.',
      details: [
        '캘린더 직접 등록: 정기 점검 및 고객 방문 일정을 날짜와 담당 직원을 선택해 캘린더에 신규 등록하고 공유할 수 있습니다.',
        '담당자 다중 배정: 현장 출장이나 정기 점검 시 1명 이상의 엔지니어를 담당자로 함께 지정할 수 있어 협업 일정 관리에 용이합니다.',
        '일정 상세 확인: 달력의 이벤트를 클릭하면 현장 업무 내용, 동행하는 담당자 목록, 구글 캘린더 연동 키 등을 한 화면에서 즉시 조회할 수 있습니다.',
        '구글 캘린더 동기화: 스케줄을 추가하거나 삭제할 때 회사 구글 캘린더와 실시간 자동 연동(API 동기화)되어 중복 일정을 방지합니다.'
      ]
    },
    {
      id: 'archive',
      title: '자료실 (기술 파일 다운로드)',
      icon: <ArchiveIcon color="primary" />,
      desc: 'Google Drive와 연동하여 현장에서 자주 쓰이는 매뉴얼, 장비 드라이버, 소프트웨어 가이드 등을 안전하게 실시간 조회합니다.',
      details: [
        'Google Drive 연동 서비스: 구글 드라이브(공유 폴더) 내의 파일 구조를 실시간 API로 가져와 트리 구조 형태로 조회합니다.',
        '편리한 파일 다운로드: 자료실 페이지 내에서 다운로드 버튼을 누르면 브라우저 새 탭이나 직접 내려받기를 통해 필요한 설치 파일과 PDF 가이드를 즉시 확보할 수 있습니다.',
        '실시간 검색 필터: 찾고자 하는 파일명을 검색란에 입력하면 현재 디렉토리 내부에서 해당하는 파일명을 빠르게 필터링해 줍니다.'
      ]
    },
    {
      id: 'customer',
      title: '거래처 정보 관리',
      icon: <CustomerIcon color="primary" />,
      desc: '유지보수 계약을 맺은 고객사 목록과 사업장 주소, 다중 연락처 담당자 데이터를 체계적으로 관리합니다.',
      details: [
        '사업장 및 담당자 정보: 신규 거래처 추가 시 상호명, 계약 종료일 외에 사업장 주소와 함께 최대 2명의 고객사 담당자 정보(이름, 연락처, 이메일)를 입력하여 상세하게 관리 대장에 추가합니다.',
        '수정 팝업 다이얼로그: 거래처 목록에서 이름을 클릭하면 모바일 환경에 최적화된 다이얼로그 수정 창이 실행되어 정보를 손쉽게 편집할 수 있습니다.',
        '관리자 전용 삭제 권한: 거래처 데이터의 유실을 방지하기 위해 거래처 삭제 버튼 노출 및 실제 삭제 동작은 관리자(Admin) 권한을 가진 계정만 실행 가능하도록 안전하게 격리되어 있습니다.'
      ]
    },
    {
      id: 'inventory',
      title: '거래처 인프라(자산) 관리',
      icon: <InventoryIcon color="primary" />,
      desc: '거래처별 보유 컴퓨터 및 서버의 상세 하드웨어 스펙과 소프트웨어 자산을 수집하여 한눈에 파악합니다.',
      details: [
        '하드웨어 정보 수집: 컴퓨터별 CPU 모델, RAM 용량, 디스크 개수 및 용량, 메인보드 모델명, 네트워크 IP 정보가 상세히 수집됩니다.',
        '소프트웨어 자산 관리: 거래처 내 PC들에 설치된 각 소프트웨어 프로그램 종류와 라이선스 현황을 중앙에서 모니터링합니다.',
        '전용 스크립트 대량 등록: COMTOOIN 전용 수집 스크립트(HTA)로 수집한 결과 파일을 CSV 업로드하면 번거로운 타이핑 없이 수백 대의 장비가 일괄 등록됩니다.',
        'AI 기반 리포트 분석: 축적된 하드웨어 사양 데이터를 기반으로 AI를 구동하여, 업그레이드가 시급한 PC 판정 및 교체 제안서를 자동으로 완성해 주는 스마트 기능을 포함합니다.'
      ]
    },
    {
      id: 'quote',
      title: '간편견적 (PDF 견적서 생성)',
      icon: <QuoteIcon color="primary" />,
      desc: '복잡한 컴퓨터 부품 명세나 텍스트 리스트를 파싱하여 빠르게 마진율을 계산하고 고품질 PDF를 생성합니다.',
      details: [
        '텍스트 명세 자동 파싱: 컴퓨존, 조이젠 장바구니 등의 화면에서 부품 견적 리스트를 드래그해 복사한 뒤 자동 파싱 입력창에 넣으면 단가와 품목 수량이 자동으로 표에 배치됩니다.',
        '마진율 일괄 계산기: 기본 적용할 퍼센트(%) 마진율을 입력하고 마진율 설정을 누르면 공급가액, 부가세, 마진, 최종 소비자 단가가 전체 일괄 정렬 계산됩니다.',
        '견적서 템플릿 관리: 자주 출고되는 규격 사양 세트들을 템플릿으로 이름을 지정하여 저장하고, 추후 필요할 때 원클릭으로 다시 꺼내 쓰거나 상세 사양을 미리 볼 수 있습니다.',
        '오프스크린 A4 PDF 출력: 반응형 레이아웃이나 잘림 현상 없는 모바일 환경에서의 깔끔한 A4 규격 출력을 위해 별도 렌더링 파이프라인을 지원하여 완벽한 PDF 견적서를 즉시 저장 및 공유할 수 있습니다.'
      ]
    },
    {
      id: 'ai-features',
      title: 'AI 편의 기능 (음성 및 AI 정돈)',
      icon: <AiIcon color="primary" />,
      desc: '텍스트 작성 편의성을 극대화하기 위해 AI 자연어 처리 모델과 디바이스 마이크 음성 인식(STT) 기능을 탑재하고 있습니다.',
      details: [
        '마이크 음성 받아쓰기: 스마트폰 및 PC 마이크 권한을 활용하여 현장 작업 도중 직접 소리 내어 말하는 것만으로 접수/처리내용 입력 필드에 텍스트가 즉시 기록됩니다.',
        'AI 문맥 정돈: 대충 받아적은 단어나 구어체 문장을 AI 엔진이 자동으로 다듬어, 고객사 제공 및 내부 보고용으로 걸맞은 격식 있고 격조 높은 유지보수 정식 문서체로 매끄럽게 교정합니다.',
        '신뢰도 높은 프라이버시: 입력된 음성 데이터와 요약할 문구들은 본 시스템 연동 API를 통해 안전하게 비공개로 처리되며, 데이터가 외부에 학습용으로 제공되지 않습니다.'
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
