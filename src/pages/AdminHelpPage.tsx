import React, { useState } from 'react';
import {
  Container, Typography, Box, Divider, Stack, Dialog, DialogTitle, DialogContent, IconButton,
  Tabs, Tab, Paper, useTheme, useMediaQuery, Grid, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import {
  HelpOutline as HelpIcon,
  Dashboard as DashboardIcon,
  CalendarMonth as CalendarIcon,
  CloudDownload as ArchiveIcon,
  Business as CustomerIcon,
  Computer as InventoryIcon,
  Receipt as QuoteIcon,
  AutoAwesome as AiIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Forum as ForumIcon
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';

interface AdminHelpProps {
  isDialog?: boolean;
  onClose?: () => void;
}

const AdminHelpPage: React.FC<AdminHelpProps> = ({ isDialog = false, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const userRole = sessionStorage.getItem('adminRole');
  const isCustomer = userRole === 'customer';

  const defaultTab = 'dashboard';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [expandedTab, setExpandedTab] = useState<string | false>(defaultTab);

  const allSections = [
    {
      id: 'dashboard',
      title: isCustomer 
        ? '대시보드 (통계 및 유지보수 내역 조회)'
        : '대시보드 (업무 기록 등록 및 통계 조회)',
      shortTitle: '대시보드',
      icon: <DashboardIcon color="primary" />,
      desc: isCustomer
        ? '유지보수 처리 실적 통계와 상세 유지보수 내역을 실시간으로 확인하고 조회하는 방법입니다.'
        : '유지보수 업무 일지를 기록/조치하고, 등록된 전체 실적과 거래처별 업무 점유율 통계를 실시간으로 확인·조회하는 방법입니다.',
      details: isCustomer 
        ? [
            '유지보수 업무 리스트 최상단 상시 정렬: 거래처 계정 로그인 시, 주요 조치 이력을 한눈에 볼 수 있도록 하단 테이블 리스트가 화면 최상단에 정갈하게 정렬되어 즉시 표시됩니다.',
            '장애 시각화 분석 접기/펼치기: 통계 수치 그래프 영역 바로 위의 [접기/펼치기] 미니 단추를 클릭하면 부드러운 슬라이딩 효과와 함께 분석 차트를 숨기거나 간편히 노출시킬 수 있습니다.',
            '원클릭 기술지원 요청 접수: 대시보드 우측 상단의 초록색 [기술지원 요청] 버튼을 눌러 장애 상세 내용 기재 및 이미지 사진(최대 5장)을 첨부하여 간편 접수할 수 있습니다. 접수가 완료되면 사내 전체 엔지니어 팀에게 실시간 푸시 알림이 발송되어 신속히 조치에 돌입합니다.',
            '접수 확인 이메일 자동 송신: 기술지원을 요청할 때 이메일 주소를 적으면, 정상 접수 완료되는 즉시 시스템이 인지하여 요청자 본인의 이메일로 접수 확인 상세 메일이 실시간 자동 발송됩니다.',
            '접수 후 상세 내역 자동 팝업 및 실시간 동기화: 기술지원 요청 제출이 완료되면 그 자리에 상세 내역 팝업 모달이 즉시 자동 기동하여 작성한 내용을 바로 재검증할 수 있습니다. 또한, 대시보드 리스트 격자 테이블 역시 새로고침 없이 실시간 100% 자동 동기화 갱신됩니다.',
            '기술지원 접수 취소(삭제): 작성하신 기술지원 요청서는 상세 조회 화면에서 언제든 삭제(취소)하실 수 있으며, 이 경우 개인정보 및 기업 정보 보안을 위해 첨부하셨던 이미지 사진들도 즉시 함께 안전하게 파기됩니다.',
            '리포트 다운로드: 테이블에서 원하는 기간을 선택한 후 [리포트 다운로드(CSV)]를 누르면, 등록된 유지보수 실적 로그를 엑셀 파일로 소장하실 수 있습니다.'
          ]
        : [
            '유지보수 일지 등록 및 조치 방법: 현장 조치나 장애 접수가 들어오면 대시보드 내의 등록 기능을 통해 일시, 거래처명, 장애 내용 등을 기재하여 예약·등록할 수 있습니다. 등록된 업무는 [처리중]으로 시작되며, 조치 완료 내용을 입력하고 저장하면 상태가 자동으로 [완료]로 갱신됩니다.',
            '음성 입력 및 AI 문장 정돈 사용하기: 일지 작성 시 텍스트 입력창 우측의 [음성] 버튼을 눌러 말하는 대로 받아쓰기(STT)를 할 수 있고, 대충 적은 거친 메모는 [AI 정돈]을 클릭해 품격 있는 공문서체 문장으로 즉시 다듬어 기재할 수 있습니다.',
            '현장 조치 사진(이미지) 첨부: 조치 전/후 증빙을 위해 모바일이나 컴퓨터에서 최대 5장까지 현장 상황 사진을 업로드해 일지에 첨부 보존할 수 있습니다.',
            '실시간 통계 및 그래프 확인: 대시보드 상단 수치 카드를 통해 진행률을 확인하고, 거래처별 비중 차트와 연간 월별 막대그래프를 통해 특정 시기의 업무 부하를 직관적으로 분석할 수 있습니다.',
            'AI 실적 분석 리포트 생성: [AI 리포트 생성] 기능을 활용하면 과거 장애 처리 이력을 AI가 정밀 분석하여, 핵심 고장 원인 추이와 업무 개선 권고가 담긴 맞춤형 보고서를 제공받을 수 있습니다.',
            '엑셀 저장 및 일괄 올리기: 하단 테이블에서 거래처/기간 필터를 적용한 후 [리포트 다운로드(CSV)]로 엑셀 저장할 수 있으며, 기존에 수동 작성된 장부는 양식에 맞춰 [CSV 업로드]로 일괄 등록할 수 있습니다.'
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
        '자료를 다운로드하는 방법: 파일 오른쪽 끝에 있는 [점 세 개(더보기)] 버튼을 클릭하고 [다운로드] 메뉴를 선택합니다. 다운로드 퍼센트(%)가 차오르는 팝업창이 나타나며, 100% 완료되면 파일 저장 창이 자동으로 뜹니다. (모바일 기기에서도 화면 이동 없이 기기 내부로 다이렉트 다운로드됩니다.)',
        '문서나 매뉴얼을 다운로드 없이 바로 읽으려면: [점 세 개(더보기)] 버튼을 클릭하고 [미리보기] 메뉴를 선택해 주세요. 별도의 설치나 다운로드 없이 웹 브라우저에서 편리하게 파일 내용을 즉시 확인할 수 있습니다.',
        '폴더 간 이동 후 최신 파일이 바로 보이지 않는 경우: 페이지 로딩 속도를 높이기 위해 이전 목록이 먼저 표시된 다음, 백그라운드에서 최신 상태로 갱신됩니다. 상단에 파란색 선이 지나가는 동안은 최신 파일을 불러오는 중이며, 필요한 경우 우측 상단 [새로고침] 버튼을 눌러 강제로 최신 정보를 즉시 가져올 수 있습니다.',
        '자료를 잘못 삭제했을 때 복원하는 방법: [점 세 개(더보기)] 버튼을 클릭하고 [삭제]를 선택하면 파일이 즉시 구글 드라이브의 휴지통으로 이동합니다. 잘못 삭제한 파일은 구글 드라이브 서비스 내의 휴지통에 접속하여 손쉽게 다시 복구하실 수 있습니다.'
      ]
    },
    {
      id: 'messenger',
      title: '메신저 (실시간 1:1 및 프로젝트 소통)',
      shortTitle: '메신저',
      icon: <ForumIcon color="primary" />,
      desc: '컴투인 사내 엔지니어 직원들과 기밀 보안이 유지되는 개별 채널을 통해 실시간 업무 소통을 나누는 방법입니다.',
      details: [
        '거래처 전용 메신저 메뉴 개방: 사이드바 및 모바일 드로워 메뉴의 [메신저] 단추를 클릭해 메신저 화면으로 즉시 진입할 수 있습니다.',
        '철저한 기밀 대화방 보안 격리: 다른 거래처와의 정보 혼선 및 유출을 방지하기 위해, 오직 본인 이름이 방 제목에 포함되어 있거나 본인이 직접 개설한 대화방만 보안 격리 노출됩니다. 타사 대화방은 절대 열람할 수 없으므로 안전하고 편안하게 업무 소통을 나누십시오.',
        '방 개설 시 거래처 접두사 자동 주입: 새로운 대화 소통방을 개설하는 경우, 입력하신 방 이름 맨 앞에 본인의 [거래처명] 접두사가 자동으로 강제 주입 생성되어 실시간 보안 연동 필터를 충족하게 됩니다.',
        '실시간 푸시 알림 타겟팅: 대화방에서 메시지를 전송하면, 최고 관리자를 방해하지 않고 실제 요청을 현장 처리할 담당 직원 멤버들에게만 정밀 타겟 알림 푸시가 도달하여 신속한 피드백 대화를 돕습니다.'
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
        '컴퓨존·조이젠 장바구니 및 견적서 화면 복사: 컴퓨존이나 조이젠의 장바구니 화면 전체 또는 견적서 조회/인쇄 화면의 내용 전체를 마우스로 드래그 복사해 [텍스트 견적 자동입력] 창에 그대로 붙여넣으면 품목명, 단가, 수량을 자동으로 분류해 표에 입력합니다.',
        '일반 텍스트 견적 파싱 규격 준수: 직접 텍스트를 기입하여 입력하는 경우, 반드시 한 줄에 [품목명] [도매단가] [수량] [합계] 형식을 공백이나 탭으로 연결하여 작성해야 정상 파싱됩니다 (예: Intel Core i5 150000 1 150000). 단가나 합계 금액이 없거나 "i5 1개" 형태의 임의 텍스트는 인식 규격에 맞지 않아 파싱 시 누락되오니 규격을 확인해 주시기 바랍니다.',
        '수동 품목 추가 및 세부 내용 수정: 파싱되지 않은 추가 부품이나 공임/설치비 등은 견적 테이블 바로 아래(하단)에 배치된 [항목 직접 추가] 버튼을 눌러 행을 추가한 뒤, 품목명, 수량, 마진(%), 견적단가를 직접 수정할 수 있으며 필요시 그 우측의 [초기화] 버튼을 눌러 전체 내용을 비울 수 있습니다.',
        '마진율 일괄 조정: 기본 마진율(%)을 일괄 조정하여 적용하면 공급가액, 마진금액, 부가세(VAT), 최종 소비자 판매가가 자동으로 수량에 맞춰 실시간 계산됩니다.',
        '자주 쓰는 견적 템플릿 보관: 사무용 본체 구성, 게이밍 추천 조립 사양 등 자주 출고되는 구성 세트는 [견적 템플릿 저장] 기능을 사용해 템플릿으로 저장한 뒤 필요할 때 바로 불러와 사용할 수 있습니다.',
        'PDF 견적서 고화질 출력: [미리보기 및 다운로드] 창을 통해 발행될 견적서의 디자인과 여백, 합계 금액 정렬을 검토한 후 [PDF 다운로드] 버튼을 누르면 인쇄 및 고객 제출에 적합한 정식 A4 PDF 문서가 저장됩니다.'
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

  // Filter help menus for customers to show only their relevant pages
  const sections = isCustomer
    ? allSections.filter(sec => sec.id === 'dashboard' || sec.id === 'inventory' || sec.id === 'messenger')
    : allSections;

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
      <Dialog 
        open={true} 
        onClose={onClose} 
        maxWidth="lg" 
        fullWidth 
        style={{ zIndex: 1400 }}
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '12px 8px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 16px)' },
            maxWidth: { xs: 'calc(100% - 16px)', sm: 'lg' }
          }
        }}
      >
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
