import React, { useState } from 'react';
import {
  Container, Typography, Box, Divider, Stack, Dialog, DialogTitle, DialogContent, IconButton,
  Tabs, Tab, Paper, useTheme, useMediaQuery, Grid, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import {
  HelpOutline as HelpIcon,
  EditNote as RequestIcon,
  Dashboard as DashboardIcon,
  CalendarMonth as CalendarIcon,
  CloudDownload as ArchiveIcon,
  Business as CustomerIcon,
  Computer as InventoryIcon,
  Receipt as QuoteIcon,
  AutoAwesome as AiIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';

interface AdminHelpProps {
  isDialog?: boolean;
  onClose?: () => void;
}

const AdminHelpPage: React.FC<AdminHelpProps> = ({ isDialog = false, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [activeTab, setActiveTab] = useState('request');
  const [expandedTab, setExpandedTab] = useState<string | false>('request');

  const userRole = localStorage.getItem('adminRole');
  const isCustomer = userRole === 'customer';

  const allSections = [
    {
      id: 'request',
      title: '업무 기록 (유지보수 일지 등록)',
      shortTitle: '업무 기록',
      icon: <RequestIcon color="primary" />,
      desc: '유지보수 거래처의 장애 접수 및 조치 내역을 간편하게 기록하고 처리 상태를 관리하는 방법입니다.',
      details: [
        '유지보수 일지 등록하기: 현장 조치나 장애 접수가 들어오면 [업무 기록] 페이지에서 일자, 거래처명, 작성자, 고객사 요청자 및 접수 내용을 기재하고 [업무 기록 저장하기]를 누르면 신규 등록됩니다.',
        '진행 상태 자동 업데이트: 신규 등록된 업무는 [처리중] 상태로 시작됩니다. 이후 하단의 처리 내용 입력칸에 조치 완료 사항을 적고 저장하면, 상태가 자동으로 [완료]로 안전하게 변경됩니다.',
        '음성 입력(STT) 및 AI 문장 정돈: 텍스트 입력창 오른쪽에 있는 [음성] 버튼을 눌러 소리 내어 직접 받아쓰기를 할 수 있으며, 구어체로 대충 받아적은 메모는 [AI 정돈]을 클릭해 품격 있는 공문서체로 즉시 다듬을 수 있습니다.',
        '현장 증빙 이미지 첨부: 조치 전/후의 상태를 보여주거나 현장 상황을 기록하기 위해 최대 5장까지 카메라 촬영 사진 및 이미지를 실시간으로 본문에 첨부해 보존할 수 있습니다.'
      ]
    },
    {
      id: 'dashboard',
      title: '대시보드 (통계 및 일지 조회)',
      shortTitle: '대시보드',
      icon: <DashboardIcon color="primary" />,
      desc: '등록된 전체 유지보수 실적과 거래처별 업무 점유율 통계를 모니터링하고 엑셀 보고서를 추출하는 방법입니다.',
      details: [
        '실시간 통계 현황 확인: 대시보드 상단 수치 카드를 통해 현재 누적된 전체 업무량과 처리 진행률(처리중, 완료)을 실시간으로 확인합니다.',
        '거래처별 비중 분석: 원형(파이) 차트를 호버하여 특정 거래처가 차지하는 고장 접수 비중을 직관적으로 파악하고 리소스를 적절히 안배합니다.',
        '연간 업무 추이 파악: 막대그래프를 통해 월별 유지보수 처리 건수의 변화 추이를 보고 특정 시기의 업무 과밀도를 미리 대비합니다.',
        'AI 성능 분석 및 실적 요약 리포트: [AI 리포트 생성] 기능을 활용하면, 우리 회사의 과거 고장/장애 조치 이력 데이터를 AI가 정밀 분석하여 핵심 고장 원인 추이와 개선 권고사항이 요약된 맞춤형 보고서를 제공받을 수 있습니다.',
        '엑셀 보고서 다운로드 및 일괄 업로드: 하단 테이블의 거래처 및 월별 검색 필터를 거쳐 정제된 리스트를 [리포트 다운로드(CSV)]로 일괄 저장해 엑셀로 활용할 수 있으며, 이전에 기록된 많은 로그들은 양식에 맞춰 [CSV 업로드]로 일괄 가져오기가 가능합니다.'
      ]
    },
    {
      id: 'schedule',
      title: '스케줄 관리 (방문 일정 관리)',
      shortTitle: '스케줄',
      icon: <CalendarIcon color="primary" />,
      desc: '고객사 정기 점검, 긴급 방문 출장 등 엔지니어의 일정을 팀 캘린더를 통해 통합 예약하고 공유하는 방법입니다.',
      details: [
        '새 일정 예약 및 배정: 방문 계획이 생기면 캘린더 화면의 해당 날짜를 클릭하거나 우측 상단 등록 기능을 열어 방문지, 일정 제목, 배정할 담당 직원을 작성하여 예약을 추가합니다.',
        '협업 엔지니어 다중 지정: 현장 출장이나 정기 점검 시 1명 이상의 엔지니어를 담당자로 동시에 지정할 수 있어 다각적인 협업 일정 편성을 돕습니다.',
        '방문 일정 수정 및 상세 확인: 달력에 예약된 일정을 클릭하면 세부 조치 내용과 동행 리스트를 볼 수 있으며, 날짜 변경 시에는 달력 안에서 마우스 드래그 & 드롭만으로 간단하게 일정을 이동할 수 있습니다.',
        '구글 캘린더 실시간 연동: 본 시스템 캘린더에서 예약을 추가, 수정, 삭제하면 회사의 연동된 구글 캘린더 계정에도 실시간으로 일정 정보가 실시간 자동 반영되어 팀 스케줄 누락을 방지합니다.'
      ]
    },
    {
      id: 'archive',
      title: '자료실 (설치 파일 및 매뉴얼)',
      shortTitle: '자료실',
      icon: <ArchiveIcon color="primary" />,
      desc: '회사 구글 드라이브와 실시간 동기화하여 현장에서 필요한 드라이버, 소프트웨어, 기술 매뉴얼을 찾아 다운로드하는 방법입니다.',
      details: [
        '구글 드라이브 폴더 탐색: 구글 공유 드라이브에 업로드된 파일 구조를 실시간 API로 가져오므로, 탐색기 형태의 디렉토리 트리 구조를 따라 설치하고자 하는 장비 브랜드별 폴더로 이동합니다.',
        '빠른 파일 내려받기: 현장 엔지니어가 필요한 소프트웨어나 PDF 매뉴얼 문서 옆의 [다운로드] 아이콘을 누르면 기기에 파일이 즉시 저장되어 현장 기술 조치가 가능합니다.',
        '실시간 키워드 필터링: 방대한 자료 중에서 특정 파일명이나 확장자를 찾고자 할 때, 상단 검색 필터를 사용하면 타이핑과 동시에 목록을 실시간으로 걸러줍니다.'
      ]
    },
    {
      id: 'customer',
      title: '거래처 정보 관리',
      shortTitle: '거래처',
      icon: <CustomerIcon color="primary" />,
      desc: '계약 중인 유지보수 회원사 목록, 담당자 정보, 로그인 계정 정보를 관리 및 조회하는 방법입니다.',
      details: [
        '신규 거래처 및 로그인 계정 일괄 등록: 새 거래처 등록 시 [등록과 동시에 로그인 계정(아이디/비밀번호) 생성하기] 옵션을 활성화하면, 거래처 기본 정보와 로그인 연동 계정을 한 번에 간편하게 생성할 수 있습니다.',
        '브라우저 자동완성 오입력 차단: 로그인 폼 및 등록 다이얼로그 내에 자동완성 방지(Autofill Prevention) 옵션이 내장되어 있어, 브라우저가 관리자의 개인 로그인 정보를 거래처 입력 필드에 강제 기입하는 현상을 원천 방지합니다.',
        '권한 등급별 안전한 조회 및 제어 분기: 최고 관리자 계정은 [정보관리] 및 [계정관리] 버튼을 통해 모든 정보를 수정·삭제할 수 있으며, 일반 멤버(Staff) 계정은 [정보조회] 및 [계정조회] 버튼으로 안전한 읽기 전용(Read-Only) 모드로만 조회 가능합니다.',
        '다중 고객 담당자 연동: 한 업체에 여러 담당자가 있는 경우 최대 2명(주담당자/부담당자)까지 이름, 직책, 개별 연락처 및 이메일 주소를 연동하여 관리 장부에 기재할 수 있습니다.',
        '중요 자산 삭제 보호 장치: 거래처 이력 유실 등 치명적인 실수를 예방하기 위해 [거래처 삭제] 권한은 시스템 내에 최고 관리자(Admin) 권한 등급을 가진 계정에게만 표시 및 활성화됩니다.'
      ]
    },
    {
      id: 'inventory',
      title: '거래처 인프라(자산) 관리',
      shortTitle: '자산 관리',
      icon: <InventoryIcon color="primary" />,
      desc: '자산 수집기(EXE)로 확보한 컴퓨터의 상세 하드웨어 부품 스펙과 소프트웨어 자산 내역을 조회하고 활용하는 방법입니다.',
      details: [
        '자산 수집기(EXE) 실행: 컴퓨터 사양 수집을 위해 거래처 PC에서 화면 상단에 제공되는 [자산 수집기 다운로드] 버튼을 클릭해 실행 파일(.exe)을 다운로드한 뒤 실행해 주십시오. (크롬에서 차단 경고가 뜨는 경우 다운로드 창에서 [유지/허용]을 선택해 주시면 안전합니다.)',
        '실시간 수집 현황 자동 등록: 자산 수집기 스캔이 완료되면, 새로고침을 누르지 않아도 실시간 백그라운드 갱신을 통해 5초 이내에 해당 거래처 인프라 목록에 자산 사양이 자동 등록됩니다.',
        '사양 상세보기 팝업 활용: PC 리스트에서 해당 사양 행을 가볍게 클릭하면 CPU, 메인보드, 설치된 여러 개의 SSD/HDD 상세 용량 사양이 정밀하게 구획된 팝업으로 표출됩니다. (다중 디스크 스캔 시 윈도우가 깔린 C드라이브가 1순위로 표시됨)',
        '모바일 최적화 통계 카드 활용: 태블릿이나 모바일로 현장에서 자산을 볼 때 스크롤의 방해를 피하려면 상단 [통계 차트 접기] 버튼을 눌러 표 영역을 넓게 확보할 수 있습니다.',
        'AI 기반 노후 PC 교체 제안: [AI 노후 장비 진단] 기능 버튼을 누르면 AI가 하드웨어 스펙을 다각도로 분석하여 성능이 미달되거나 교체가 시급한 PC를 판별하고, 고객사 전달용 업그레이드 리포트 제안서를 대필 작성해 줍니다.'
      ]
    },
    {
      id: 'quote',
      title: '간편견적 (PDF 견적서 생성)',
      shortTitle: '간편견적',
      icon: <QuoteIcon color="primary" />,
      desc: '부품 장바구니 텍스트 복사만으로 단가와 마진을 실시간 조율하고 A4 규격의 고화질 PDF 견적서를 발행하는 방법입니다.',
      details: [
        '복사한 장바구니 텍스트 파싱: 컴퓨존, 조이젠 등 도매몰 장바구니 리스트를 복사한 뒤 [텍스트 견적 자동입력] 란에 그대로 붙여넣으면 품목명, 단가, 수량이 표에 자동으로 한 번에 정렬 입력됩니다.',
        '수동 품목 추가 및 세부 내용 수정: 파싱되지 않은 특수 품목이나 작업비(조립 공임, 출장 설치비 등)는 [직접 추가] 버튼을 눌러 표에 행을 추가한 뒤, 품목명, 수량, 마진(%), 견적단가를 수동으로 클릭하여 즉각 수정할 수 있습니다.',
        '마진율 일괄 조정: 기본 마진 퍼센트(%)를 입력하고 적용하면 공급가액, 마진, 부가세(VAT), 최종 소비자 판매가가 자동으로 수량에 맞춰 실시간 재계산됩니다.',
        '자주 쓰는 견적 템플릿 보관: 사무용 세트, 고급 게이밍 구성 등 자주 조립/납품하는 세트 구성을 [견적 템플릿 저장]으로 저장한 뒤, 다음 견적 작성 시 불러와 활용할 수 있습니다.',
        'PDF 인쇄용 미리보기 및 다운로드: [미리보기 및 다운로드] 창을 통해 최종 견적서의 여백과 합계금액 정렬을 확인한 후, [PDF 다운로드] 버튼을 눌러 고객 제출용 정식 A4 PDF를 저장합니다.'
      ]
    },
    {
      id: 'ai-features',
      title: 'AI 편의 기능 (시스템 통합 AI)',
      shortTitle: 'AI 기능',
      icon: <AiIcon color="primary" />,
      desc: '플랫폼 내부 곳곳에 연동된 지능형 AI 가상 비서를 실무에 효과적으로 활용하는 조작 매뉴얼 가이드입니다.',
      details: [
        '현장 업무 대필 교정기 활용: [업무 기록] 창에서 말로 받아적는 [음성] 녹음이 완료되면, 앞뒤 문맥이 어색하거나 구어체로 헝클어진 텍스트를 선택하여 [AI 정돈]을 누르십시오. AI가 상황에 맞는 정중한 현장 조치 공문서 서식으로 즉시 변환해 줍니다.',
        '노후 PC 판정 및 견적 대필 활용: 자산 관리 화면에서 기기 노후도를 수동으로 판단하기 까다로울 때, AI 진단 메뉴를 실행하면 하드웨어 등급을 자동 계산해 제안서 초안을 순식간에 작성해 줍니다.',
        '유지보수 실적 요약 비서 활용: 대시보드 통계 분석 시 AI 리포트 생성기를 켜면, 방대한 과거 장애 이력 데이터를 AI가 심층 스캔하여 핵심 이슈 추이와 원인을 문장 형태로 예쁘게 요약 및 제안해 줍니다.',
        '안전한 데이터 프라이버시 원칙: 본 ITSM 시스템에서 다루는 모든 텍스트와 하드웨어 수집 데이터는 연동된 AI 모델의 외부 기계학습용으로 공유되지 않는 보안 API로 연동되어 있으므로 실무 보안 정책에 위배되지 않습니다.'
      ]
    }
  ];

  // Show all help menus to everyone to avoid role mismatches and provide full system guidance
  const sections = allSections;

  const activeSection = sections.find(sec => sec.id === activeTab) || sections[0];

  const desktopContent = activeSection ? (
    <Grid container spacing={3}>
      {/* 좌측 탭 선택 영역 */}
      <Grid item xs={3.5}>
        <Tabs
          orientation="vertical"
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          sx={{
            borderRight: 1,
            borderColor: 'divider',
            height: '520px',
            '&& .MuiTab-root': {
              alignItems: 'flex-start',
              textAlign: 'left',
              py: 1.8,
              px: 2,
              minHeight: 'auto',
              borderBottom: '1px solid #f1f5f9',
              mr: 0,
              '&.Mui-selected': {
                bgcolor: '#f1f5f9',
              }
            }
          }}
        >
          {sections.map(sec => (
            <Tab 
              key={sec.id}
              value={sec.id}
              label={
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', '& svg': { fontSize: '1.2rem', color: activeTab === sec.id ? 'primary.main' : 'text.secondary' } }}>
                    {sec.icon}
                  </Box>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ color: activeTab === sec.id ? 'primary.main' : 'text.primary', fontSize: '0.875rem' }}>
                    {sec.shortTitle}
                  </Typography>
                </Stack>
              }
            />
          ))}
        </Tabs>
      </Grid>

      {/* 우측 상세 설명 영역 */}
      <Grid item xs={8.5}>
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 3.5, 
            borderRadius: 2, 
            bgcolor: 'background.paper', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            height: '520px',
            overflowY: 'auto'
          }}
        >
          <Stack spacing={3}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ display: 'flex', alignItems: 'center', '& svg': { fontSize: '1.5rem', color: 'primary.main' } }}>
                {activeSection.icon}
              </Box>
              <Typography variant="h6" fontWeight="bold" color="text.primary">
                {activeSection.title}
              </Typography>
            </Stack>
            
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                p: 2, 
                bgcolor: '#f8fafc', 
                borderRadius: 1.5, 
                borderLeft: '4px solid', 
                borderColor: 'primary.main', 
                lineHeight: 1.6,
                fontSize: '0.9rem'
              }}
            >
              {activeSection.desc}
            </Typography>

            <Box>
              <Typography 
                variant="subtitle2" 
                fontWeight="bold" 
                sx={{ 
                  mb: 2, 
                  color: 'text.primary', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5,
                  fontSize: '0.95rem'
                }}
              >
                <InfoIcon sx={{ fontSize: '1.15rem' }} /> 상세 이용 절차 및 사용 팁
              </Typography>
              <Stack spacing={2}>
                {activeSection.details.map((tip, idx) => (
                  <Box 
                    key={idx} 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      fontSize: '0.875rem', 
                      color: 'text.primary', 
                      lineHeight: 1.6 
                    }}
                  >
                    <Box 
                      sx={{ 
                        mr: 1.5, 
                        mt: 0.2, 
                        width: 22, 
                        height: 22, 
                        borderRadius: '50%', 
                        bgcolor: '#e3f2fd', 
                        color: 'primary.main', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold', 
                        flexShrink: 0 
                      }}
                    >
                      {idx + 1}
                    </Box>
                    <Box sx={{ pt: 0.2 }}>{tip}</Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  ) : null;

  const mobileContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {sections.map((sec) => (
        <Accordion 
          key={sec.id} 
          expanded={expandedTab === sec.id} 
          onChange={(e, isExpanded) => setExpandedTab(isExpanded ? sec.id : false)}
          variant="outlined"
          sx={{ 
            borderRadius: '8px !important',
            '&:before': { display: 'none' },
            borderColor: expandedTab === sec.id ? 'primary.main' : 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ display: 'flex', alignItems: 'center', '& svg': { fontSize: '1.2rem', color: 'primary.main' } }}>
                {sec.icon}
              </Box>
              <Typography fontWeight="bold" sx={{ fontSize: '0.9rem' }}>
                {sec.title}
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2.5, pt: 0.5 }}>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                mb: 2, 
                p: 1.5, 
                bgcolor: '#f8fafc', 
                borderRadius: 1, 
                borderLeft: '3px solid', 
                borderColor: 'primary.light', 
                lineHeight: 1.5,
                fontSize: '0.85rem'
              }}
            >
              {sec.desc}
            </Typography>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5, fontSize: '0.875rem' }}>
              상세 이용 절차 및 사용 팁
            </Typography>
            <Stack spacing={1.5}>
              {sec.details.map((tip, idx) => (
                <Box 
                  key={idx} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    fontSize: '0.825rem', 
                    color: 'text.primary', 
                    lineHeight: 1.5 
                  }}
                >
                  <Box 
                    sx={{ 
                      mr: 1.2, 
                      mt: 0.2, 
                      width: 18, 
                      height: 18, 
                      borderRadius: '50%', 
                      bgcolor: '#e3f2fd', 
                      color: 'primary.main', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '0.7rem', 
                      fontWeight: 'bold', 
                      flexShrink: 0 
                    }}
                  >
                    {idx + 1}
                  </Box>
                  <Box sx={{ pt: 0.1 }}>{tip}</Box>
                </Box>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );

  const helpContent = isMobile ? mobileContent : desktopContent;

  if (isDialog) {
    return (
      <Dialog open={true} onClose={onClose} maxWidth="lg" fullWidth style={{ zIndex: 1400 }} fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <HelpIcon color="action" sx={{ fontSize: '1.25rem' }} />
            <span>시스템 도움말 및 사용 가이드</span>
          </Box>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3, bgcolor: '#f8fafc' }}>
          {helpContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
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
          {isCustomer 
            ? '컴투인 IT 서비스 관리(ITSM) 플랫폼의 주요 기능과 거래처용 사용 가이드를 제공합니다.'
            : '컴투인 IT 서비스 관리(ITSM) 플랫폼의 주요 기능과 직원용 사용 팁을 제공합니다.'
          }
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />
      {helpContent}
    </Container>
  );
};

export default AdminHelpPage;
