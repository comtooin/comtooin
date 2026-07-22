import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Typography, Box, Paper, Stack, Button, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, IconButton, Grid, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Pagination, Tooltip, TableSortLabel,
  useTheme, useMediaQuery
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  FileUpload as FileUploadIcon,
  FileDownload as FileDownloadIcon,
  Computer as ComputerIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  DeleteSweep as DeleteSweepIcon,
  AutoAwesome as AiIcon,
  BarChart as BarChartIcon,
  Info as InfoIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';
import Papa from 'papaparse';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Hardware {
  id: string;
  computer_name: string;
  department?: string;
  user_name?: string;
  ip_address: string;
  os: string;
  processor: string;
  motherboard: string;
  memory: string;
  graphic_card: string;
  storage: string;
}

interface Software {
  id: string;
  computer_name: string;
  program_name: string;
  program_version: string;
  publisher: string;
}

interface Customer {
  id: string;
  name: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const AdminCustomerInventoryPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [hardware, setHardware] = useState<Hardware[]>([]);
  const [software, setSoftware] = useState<Software[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabValue, setTabValue] = useState(0);

  // AI 리포트 상태
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiReportContent, setAiReportContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewPages, setPreviewPages] = useState<string[]>([]);

  // 정보 수정 모달 상태
  const [openModal, setOpenModal] = useState(false);
  const [modalType, setModalType] = useState<'hardware' | 'software'>('hardware');
  const [formData, setFormData] = useState<any>({});

  // 페이징 상태
  const [hwPage, setHwPage] = useState(1);
  const hwRowsPerPage = 15;
  const [swPage, setSwPage] = useState(1);
  const swRowsPerPage = 15;
  
  // 정렬 상태
  const [hwSortConfig, setHwSortConfig] = useState<{ key: keyof Hardware, direction: 'asc' | 'desc' } | null>(null);
  const [swSortConfig, setSwSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // 컨테이너 참조 (스크롤 초기화)
  const hwTableRef = useRef<HTMLDivElement>(null);
  const swTableRef = useRef<HTMLDivElement>(null);

  // 소프트웨어 상세보기 팝업 상태
  const [swDetailOpen, setSwDetailOpen] = useState(false);
  const [selectedComputer, setSelectedComputer] = useState<string>('');
  const [swDetailPage, setSwDetailPage] = useState(1);
  const swDetailRowsPerPage = 15;

  // 하드웨어 상세보기 팝업 상태
  const [hwDetailOpen, setHwDetailOpen] = useState(false);
  const [selectedHardware, setSelectedHardware] = useState<Hardware | null>(null);

  // 모바일 통계 접기/펼치기 상태 (모바일 전용)
  const [showStats, setShowStats] = useState(false);

  const userRole = localStorage.getItem('adminRole');
  const customerId = localStorage.getItem('adminCustomerId');

  useEffect(() => {
    if (userRole === 'customer' && id !== customerId) {
      alert('접근 권한이 없습니다.');
      navigate(`/admin/customers/${customerId}/inventory`, { replace: true });
    }
  }, [userRole, id, customerId, navigate]);

  useEffect(() => {
    if (!id) return;
    
    fetchInventoryData();

    // Supabase Realtime 구독 설정 (클라이언트 측에서 변경 즉시 silent 리로드)
    const channel = supabase
      .channel(`inventory_changes_${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_hardware'
        },
        () => {
          fetchInventoryData(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_software'
        },
        () => {
          fetchInventoryData(true);
        }
      )
      .subscribe();

    // 실시간 CDC 미지원 또는 웹소켓 차단 환경 대비 5초 주기 폴링
    const pollInterval = setInterval(() => {
      fetchInventoryData(true);
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (aiModalOpen && aiReportContent) {
      // 1. 임시 컨테이너 생성 (layout 계산용 오프스크린 렌더링)
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '794px';
      container.style.boxSizing = 'border-box';
      
      const styleSheet = document.createElement("style");
      styleSheet.innerText = `
        .pdf-page-preview {
          width: 794px;
          height: 1123px;
          background-color: #ffffff;
          padding: 60px 50px 80px 50px;
          box-sizing: border-box;
          font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
          color: #333333;
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .pdf-page-preview h1 { font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 10px; color: #111; }
        .pdf-page-preview .subtitle { font-size: 12px; text-align: center; margin-bottom: 30px; color: #666666; border-bottom: 2px solid #673ab7; padding-bottom: 15px; }
        .pdf-page-preview h2 { font-size: 18px; font-weight: bold; margin-top: 25px; margin-bottom: 12px; color: #673ab7; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
        .pdf-page-preview h3 { font-size: 14px; font-weight: bold; margin-top: 18px; margin-bottom: 8px; color: #333; }
        .pdf-page-preview p { font-size: 13.5px; line-height: 1.7; margin-bottom: 12px; text-align: justify; }
        .pdf-page-preview ul { padding-left: 20px; margin-bottom: 12px; font-size: 13.5px; line-height: 1.7; }
        .pdf-page-preview li { margin-bottom: 6px; }
        .pdf-page-preview table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; }
        .pdf-page-preview th { background-color: #f5f5f5; border: 1px solid #ddd; padding: 8px; font-weight: bold; text-align: center; }
        .pdf-page-preview td { border: 1px solid #ddd; padding: 8px; line-height: 1.5; }
      `;
      container.appendChild(styleSheet);
      document.body.appendChild(container);

      const parserDiv = document.createElement('div');
      parserDiv.innerHTML = aiReportContent;

      const pageDivs: HTMLDivElement[] = [];
      const customerNameLabel = customer?.name || '거래처';
      const titleText = `자산 분석 리포트 - ${customerNameLabel}`;
      const subtitleText = `분석 일자: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}`;

      const createNewPage = (pageNum: number) => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page-preview';
        
        if (pageNum === 1) {
          const title = document.createElement('h1');
          title.innerText = titleText;
          pageDiv.appendChild(title);

          const sub = document.createElement('div');
          sub.className = 'subtitle';
          sub.innerText = subtitleText;
          pageDiv.appendChild(sub);
        } else {
          const header = document.createElement('div');
          header.className = 'pdf-header';
          header.style.fontSize = '11px';
          header.style.color = '#999';
          header.style.borderBottom = '1px solid #eee';
          header.style.paddingBottom = '5px';
          header.style.marginBottom = '20px';
          header.innerText = `${titleText} - 이어짐`;
          pageDiv.appendChild(header);
        }
        
        container.appendChild(pageDiv);
        pageDivs.push(pageDiv);
        return pageDiv;
      };

      const getElementFullHeight = (el: HTMLElement): number => {
        const rectHeight = el.getBoundingClientRect().height;
        const style = window.getComputedStyle(el);
        const marginTop = parseFloat(style.marginTop) || 0;
        const marginBottom = parseFloat(style.marginBottom) || 0;
        return rectHeight + marginTop + marginBottom;
      };

      let currentPageNum = 1;
      let currentPage = createNewPage(currentPageNum);
      const MAX_CONTENT_HEIGHT = 860; // 860px로 여유 공간 최적화

      let children = Array.from(parserDiv.childNodes);
      if (children.length === 1 && children[0].nodeType === Node.ELEMENT_NODE) {
        const firstChild = children[0] as HTMLElement;
        if (firstChild.tagName.toLowerCase() === 'div' || firstChild.tagName.toLowerCase() === 'section') {
          children = Array.from(firstChild.childNodes);
        }
      }

      for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) {
          continue;
        }

        const currentPageHasContent = Array.from(currentPage.children).some(
          node => {
            const el = node as HTMLElement;
            return el.className !== 'page-number' && 
                   el.tagName.toLowerCase() !== 'h1' && 
                   el.className !== 'subtitle' && 
                   el.className !== 'pdf-header';
          }
        );

        // 1. 수동 page-break 식별 및 카테고리별(2., 3., 4. 등) 강제 페이지 분할
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          const tagName = el.tagName.toLowerCase();
          
          const isPageBreak = el.className === 'page-break' || el.tagName.toLowerCase() === 'page-break';
          
          let isNewCategory = false;
          if (tagName === 'h2') {
            const text = el.innerText || el.textContent || '';
            isNewCategory = /^([2-9]|\d{2,})\./.test(text.trim());
          }

          if (isPageBreak || (isNewCategory && currentPageHasContent)) {
            currentPageNum++;
            currentPage = createNewPage(currentPageNum);
            if (isPageBreak) {
              continue;
            }
          }
        }

        const clone = child.cloneNode(true) as HTMLElement;
        currentPage.appendChild(clone);
        void currentPage.offsetHeight;

        let contentHeight = 0;
        for (const node of Array.from(currentPage.children)) {
          const el = node as HTMLElement;
          contentHeight += getElementFullHeight(el);
        }

        const contentChildrenCount = Array.from(currentPage.children).filter(
          node => {
            const el = node as HTMLElement;
            return el.tagName.toLowerCase() !== 'h1' && 
                   el.className !== 'subtitle' && 
                   el.className !== 'pdf-header';
          }
        ).length;

        if (contentHeight > MAX_CONTENT_HEIGHT && contentChildrenCount > 1) {
          currentPage.removeChild(clone);
          currentPageNum++;
          currentPage = createNewPage(currentPageNum);
          currentPage.appendChild(clone);
          void currentPage.offsetHeight;
        }
      }

      const resultHtmls = pageDivs.map(div => div.innerHTML);
      document.body.removeChild(container);
      setPreviewPages(resultHtmls);
    }
  }, [aiModalOpen, aiReportContent, customer]);

  const fetchInventoryData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // 1. 고객사 정보
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();
      if (customerError) throw customerError;
      setCustomer(customerData);

      // 2. 하드웨어 목록
      const { data: hwData, error: hwError } = await supabase
        .from('customer_hardware')
        .select('*')
        .eq('customer_id', id);
      if (hwError) throw hwError;
      setHardware(hwData || []);

      // 3. 소프트웨어 목록
      const { data: swData, error: swError } = await supabase
        .from('customer_software')
        .select('*')
        .eq('customer_id', id);
      if (swError) throw swError;
      setSoftware(swData || []);

    } catch (err: any) {
      setError(err.message || '데이터를 불러오는데 실패했습니다.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'hardware' | 'software') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'EUC-KR', // 윈도우 HTA(VBScript)로 생성된 CSV는 기본적으로 ANSI(EUC-KR) 인코딩
      complete: async (results: any) => {
        try {
          const rows = results.data as any[];

          // 띄어쓰기나 대소문자가 달라도 키워드로 값을 찾을 수 있도록 헬퍼 함수 추가
          const getVal = (row: any, keywords: string[]) => {
            const key = Object.keys(row).find(k => {
              const cleanKey = k.replace(/\s+/g, '').toLowerCase();
              return keywords.some(kw => cleanKey.includes(kw));
            });
            const val = key ? row[key] : null;
            if (typeof val === 'string') {
              return val.replace(/\0/g, '').replace(/\\u0000/g, ''); // PostgreSQL 에러 방지용 NULL 바이트 제거
            }
            return val;
          };
          
          let validRowsCount = 0;
          
          if (type === 'hardware') {
            const validRows = rows.filter(row => getVal(row, ['컴퓨터이름', 'computername', 'pc명']));
            if (validRows.length === 0) throw new Error("유효한 하드웨어 데이터(컴퓨터이름)를 찾을 수 없습니다.");
            validRowsCount = validRows.length;

            const inserts = validRows.map(row => ({
              customer_id: id,
              computer_name: getVal(row, ['컴퓨터이름', 'computername', 'pc명']) || 'Unknown',
              department: getVal(row, ['부서', 'department', 'dept']),
              user_name: getVal(row, ['사용자이름', '사용자', 'username', 'user', 'owner']),
              ip_address: getVal(row, ['ip주소', 'ipaddress', 'ip']),
              os: getVal(row, ['운영체제', 'os']),
              processor: getVal(row, ['프로세서', 'processor', 'cpu']),
              motherboard: getVal(row, ['메인보드', 'motherboard', 'baseboard']),
              memory: getVal(row, ['메모리', 'memory', 'ram']),
              graphic_card: getVal(row, ['그래픽카드', 'graphiccard', 'gpu', '비디오', '디스플레이']),
              storage: getVal(row, ['저장장치', 'storage', '디스크', 'disk'])
            }));
            const { error: insertError } = await supabase.from('customer_hardware').insert(inserts);
            if (insertError) throw insertError;
          } else {
            const validRows = rows.filter(row => getVal(row, ['컴퓨터이름', 'computername', 'pc명']) && getVal(row, ['프로그램명', 'programname']));
            if (validRows.length === 0) throw new Error("유효한 소프트웨어 데이터를 찾을 수 없습니다.");
            validRowsCount = validRows.length;

            const inserts = validRows.map(row => ({
              customer_id: id,
              computer_name: getVal(row, ['컴퓨터이름', 'computername', 'pc명']) || 'Unknown',
              program_name: getVal(row, ['프로그램명', 'programname']),
              program_version: getVal(row, ['프로그램버전', 'version', '버전']),
              publisher: getVal(row, ['공급자', 'publisher', '제조사'])
            }));
            const { error: insertError } = await supabase.from('customer_software').insert(inserts);
            if (insertError) throw insertError;
          }

          setSuccess(`${type === 'hardware' ? '하드웨어' : '소프트웨어'} CSV 파일이 성공적으로 업로드되었습니다. (총 ${validRowsCount}개 적용)`);
          fetchInventoryData(); // 새로고침
        } catch (err: any) {
          setError(`업로드 실패: ${err.message}`);
        }
      },
      error: (error: any) => {
        setError(`CSV 파싱 에러: ${error.message}`);
      }
    });
    
    event.target.value = '';
  };

  const handleDownloadExe = async () => {
    try {
      const response = await fetch(`/comtooin_scanner.exe?t=${new Date().getTime()}`);
      if (!response.ok) throw new Error('자산 수집기 파일을 로드하지 못했습니다.');
      const arrayBuffer = await response.arrayBuffer();

      // Supabase 설정 및 거래처 정보 동적 치환
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
      const customerId = id || '';
      const customerName = customer?.name || '고객사';

      const configStr = `\nCT_CONFIG_START|${supabaseUrl}|${supabaseAnonKey}|${customerId}|${customerName}|CT_CONFIG_END`;
      
      const encoder = new TextEncoder();
      const configBytes = encoder.encode(configStr);
      
      const exeBytes = new Uint8Array(arrayBuffer);
      const finalBytes = new Uint8Array(exeBytes.length + configBytes.length);
      finalBytes.set(exeBytes, 0);
      finalBytes.set(configBytes, exeBytes.length);

      const blob = new Blob([finalBytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `comtooin_collector_${customerName}.exe`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`다운로드 실패: ${err.message}`);
    }
  };

  const openEditModal = (row: any, type: 'hardware' | 'software') => {
    setModalType(type);
    setFormData(row);
    setOpenModal(true);
  };

  const handleEditSubmit = async () => {
    if (!formData.computer_name) {
      alert("컴퓨터이름은 필수 항목입니다.");
      return;
    }
    
    try {
      const { id: itemId, customer_id, created_at, updated_at, ...updateData } = formData;
      const table = modalType === 'hardware' ? 'customer_hardware' : 'customer_software';
      const { error: updateError } = await supabase.from(table).update(updateData).eq('id', itemId);
      if (updateError) throw updateError;
      
      alert('정보 수정이 정상적으로 완료되었습니다.');
      setOpenModal(false);
      fetchInventoryData(); // 새로고침
    } catch (err: any) {
      setError(`정보 수정 실패: ${err.message}`);
    }
  };

  const handleDelete = async (itemId: string, type: 'hardware' | 'software') => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return false;
    try {
      const table = type === 'hardware' ? 'customer_hardware' : 'customer_software';
      const { error: delError } = await supabase.from(table).delete().eq('id', itemId);
      if (delError) throw delError;
      
      if (type === 'hardware') setHardware(prev => prev.filter(h => h.id !== itemId));
      else setSoftware(prev => prev.filter(s => s.id !== itemId));
      alert('삭제가 완료되었습니다.');
      return true;
    } catch (err: any) {
      setError(`삭제 실패: ${err.message}`);
      return false;
    }
  };

  const handleDeleteByComputer = async (compName: string) => {
    if (!window.confirm(`정말 [${compName}] PC의 모든 소프트웨어 목록을 삭제(초기화)하시겠습니까?`)) return;
    try {
      const { error: delError } = await supabase.from('customer_software').delete().eq('customer_id', id).eq('computer_name', compName);
      if (delError) throw delError;
      
      setSoftware(prev => prev.filter(s => s.computer_name !== compName));
      setSuccess(`[${compName}] 의 소프트웨어 목록이 초기화되었습니다.`);
    } catch (err: any) {
      setError(`일괄 삭제 실패: ${err.message}`);
    }
  };

  const handleDeleteAll = async (type: 'hardware' | 'software') => {
    const label = type === 'hardware' ? '하드웨어' : '소프트웨어';
    if (!window.confirm(`정말 이 고객사의 모든 ${label} 자산 목록을 완전히 초기화(삭제)하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    
    try {
      const table = type === 'hardware' ? 'customer_hardware' : 'customer_software';
      const { error: delError } = await supabase.from(table).delete().eq('customer_id', id);
      if (delError) throw delError;
      
      if (type === 'hardware') setHardware([]);
      else setSoftware([]);
      
      setSuccess(`모든 ${label} 자산 목록이 성공적으로 초기화되었습니다.`);
    } catch (err: any) {
      setError(`전체 초기화 실패: ${err.message}`);
    }
  };

  const handleGenerateAiReport = async () => {
    if (hardware.length === 0 && software.length === 0) {
      alert('분석할 데이터가 없습니다.');
      return;
    }

    try {
      setIsGenerating(true);
      setError('');
      
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) throw new Error("인증 세션이 만료되었습니다.");

      const hardwareSummary = `총 PC 대수: ${hardware.length}대\n` + 
        hardware.map(h => `- ${h.computer_name}: CPU ${h.processor}, 메모리 ${h.memory}, OS ${h.os}`).join('\n');
      
      const swSummary: Record<string, number> = {};
      software.forEach(s => {
        const name = s.program_name;
        swSummary[name] = (swSummary[name] || 0) + 1;
      });
      const topSw = Object.entries(swSummary).sort((a,b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => `${name} (${count}개)`).join(', ');

      const prompt = `다음은 '${customer?.name}' 고객사의 IT 자산(인벤토리) 현황입니다.\n` + 
        `[하드웨어 요약]\n${hardwareSummary}\n\n` + 
        `[주요 소프트웨어 Top 15]\n${topSw}\n\n` +
        `이 데이터를 바탕으로 고객사에게 제공할 전문적인 '자산 현황 분석 리포트'를 작성해주세요.\n\n` +
        `리포트는 반드시 다음 4가지 대분류(h2)로 구성되어야 합니다:\n` +
        `1. 금월 핵심 요약 (Key Summary)\n` +
        `2. 주요 장애 현황 요약\n` +
        `3. 하드웨어 상태 및 예방 조치 현황\n` +
        `4. 원내 보안 관리 등급\n\n` +
        `작성 양식 지침:\n` +
        `1. 출력은 마크다운이 아닌 반드시 **HTML 형식**으로만 출력해주세요. <html> 이나 <body> 태그는 포함하지 말고 <h1>, <h2>, <p>, <ul>, <li>, <table>, <tr>, <th>, <td> 등 내용 태그만 사용하세요.\n` +
        `2. 가독성을 위해 테이블(<table>)과 목록(<ul>, <li>)을 적극 활용하고, 인라인 CSS 스타일(style="...")을 가미하여 깔끔한 테두리와 폰트 색상을 지정하십시오. 주 테마 색상은 컴투인 브랜드 컬러인 보라색(#673ab7)을 사용하세요.\n` +
        `3. 하드웨어 사양 분포나 교체 비중을 보여줄 때, 아래 양식의 HTML/CSS 가로 막대 그래프를 포함하여 시각적으로 표현해주세요:\n` +
        `   <div style="margin-bottom:10px;"><span style="display:inline-block;width:150px;font-size:13px;">[항목명] ([비율]%)</span><span style="display:inline-block;vertical-align:middle;width:200px;height:12px;background:#e0e0e0;border-radius:6px;margin-right:8px;overflow:hidden;"><span style="display:block;width:[비율]%;height:100%;background:#673ab7;border-radius:6px;"></span></span> <span>[대수]대</span></div>\n` +
        `4. **주제별 A4 1페이지 분량 풍성화 규칙**: 리포트의 4가지 주요 카테고리(1, 2, 3, 4)는 각각 인쇄 시 A4 용지 1페이지에 배치되므로, 각 항목 아래의 텍스트와 표 내용을 매우 상세하게 서술식 단락과 목록으로 풍부하게 채워주십시오. 요약형 문장은 지양하고, 구체적인 분석 의견, 관련 부서 분석, 장비 목록 표, 향후 대책 등을 대량으로 추가하여 각 페이지가 시각적으로 빈 공간 없이 알차게 가득 차도록(최소 10~15줄 이상의 텍스트 및 상세 표) 작성해 주십시오.\n` +
        `5. **페이지 구분**: 각 대분류(h2)가 시작되기 직전에 반드시 \`<div class="page-break"></div>\` 태그를 삽입해 주십시오.\n` +
        `6. **주의(절대 준수)**: 리포트 가장 끝단에 '기술지원문의: 15XX-XXXX', '전화번호', '서비스 데스크 연락처', 또는 '컴투인 IT 인프라 유지보수 서비스팀 ☎ (문의: 1544-XXXX)'와 같은 일반적인 고객 안내 연락처 안내 문구는 **절대 포함하지 마십시오**. 리포트는 4번 항목의 보안 등급 분석 내용으로만 깔끔하게 끝내야 합니다.`;

      const response = await fetch(`${(supabase as any).supabaseUrl}/functions/v1/generate-ai-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          customerName: customer?.name,
          action: 'inventory_preview',
          content: prompt
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      let cleanReport = data.report || data.content || JSON.stringify(data);
      cleanReport = cleanReport.replace(/추가적인 기술 지원 및 장애 문의 사항은 서비스 데스크로 즉시 연락해 주시기 바랍니다\.?/gi, '');
      cleanReport = cleanReport.replace(/컴투인 IT 인프라 유지보수 서비스팀 ☎ \(문의: [^)]+\)/gi, '');
      cleanReport = cleanReport.replace(/컴투인 IT 인프라 유지보수 서비스팀 ☎/gi, '');
      cleanReport = cleanReport.replace(/기술지원\s*문의\s*:\s*.*$/gim, '');
      cleanReport = cleanReport.replace(/기술\s*지원\s*문의\s*:\s*.*$/gim, '');
      cleanReport = cleanReport.replace(/기술지원문의\s*:\s*.*$/gim, '');
      cleanReport = cleanReport.replace(/문의\s*:\s*\d{2,4}[-\s]?\d{3,4}[-\s]?(?:\d{4}|XXXX)/gi, '');
      cleanReport = cleanReport.replace(/문의\s*전화\s*:\s*.*$/gim, '');

      setAiReportContent(cleanReport);
      setAiModalOpen(true);
    } catch (err: any) {
      console.error("AI Report Generation Error:", err);
      setError(`AI 리포트 생성 실패: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadAiReport = async () => {
    if (!aiReportContent) return;
    try {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const customerNameLabel = customer?.name || '거래처';
      const filename = `${customerNameLabel}_자산분석리포트_${todayStr}.pdf`;

      // 1. 임시 컨테이너 생성 (layout 계산을 위해 absolute 및 left -9999px로 오프스크린 렌더링)
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '794px';
      container.style.boxSizing = 'border-box';
      
      const styleSheet = document.createElement("style");
      styleSheet.innerText = `
        .pdf-page {
          width: 794px;
          height: 1123px;
          background-color: #ffffff;
          padding: 60px 50px 80px 50px;
          box-sizing: border-box;
          font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
          color: #333333;
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .pdf-page h1 { font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 10px; color: #111; }
        .pdf-page .subtitle { font-size: 12px; text-align: center; margin-bottom: 30px; color: #666666; border-bottom: 2px solid #673ab7; padding-bottom: 15px; }
        .pdf-page h2 { font-size: 18px; font-weight: bold; margin-top: 40px; margin-bottom: 20px; color: #673ab7; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
        .pdf-page h3 { font-size: 14px; font-weight: bold; margin-top: 25px; margin-bottom: 15px; color: #333; }
        .pdf-page p { font-size: 14px; line-height: 1.85; margin-bottom: 20px; text-align: justify; }
        .pdf-page ul { padding-left: 20px; margin-bottom: 20px; font-size: 14px; line-height: 1.85; }
        .pdf-page li { margin-bottom: 10px; }
        .pdf-page table { width: 100%; border-collapse: collapse; margin: 25px 0; font-size: 13px; }
        .pdf-page th { background-color: #f5f5f5; border: 1px solid #ddd; padding: 12px; font-weight: bold; text-align: center; }
        .pdf-page td { border: 1px solid #ddd; padding: 12px; line-height: 1.6; }
        .pdf-page .page-number {
          position: absolute;
          bottom: 30px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 11px;
          color: #999999;
        }
      `;
      container.appendChild(styleSheet);
      document.body.appendChild(container);

      // HTML을 임시 파서 엘리먼트에 파싱
      const parserDiv = document.createElement('div');
      parserDiv.innerHTML = aiReportContent;
      
      const pages: HTMLDivElement[] = [];
      const titleText = `자산 분석 리포트 - ${customerNameLabel}`;
      const subtitleText = `분석 일자: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}`;

      const createNewPage = (pageNum: number) => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page';
        
        if (pageNum === 1) {
          const title = document.createElement('h1');
          title.innerText = titleText;
          pageDiv.appendChild(title);

          const sub = document.createElement('div');
          sub.className = 'subtitle';
          sub.innerText = subtitleText;
          pageDiv.appendChild(sub);
        } else {
          const header = document.createElement('div');
          header.className = 'pdf-header';
          header.style.fontSize = '11px';
          header.style.color = '#999';
          header.style.borderBottom = '1px solid #eee';
          header.style.paddingBottom = '5px';
          header.style.marginBottom = '20px';
          header.innerText = `${titleText} - 이어짐`;
          pageDiv.appendChild(header);
        }
        
        const pageNumDiv = document.createElement('div');
        pageNumDiv.className = 'page-number';
        pageNumDiv.innerText = `- ${pageNum} -`;
        pageDiv.appendChild(pageNumDiv);
        
        container.appendChild(pageDiv);
        pages.push(pageDiv);
        return pageDiv;
      };

      const getElementFullHeight = (el: HTMLElement): number => {
        const rectHeight = el.getBoundingClientRect().height;
        const style = window.getComputedStyle(el);
        const marginTop = parseFloat(style.marginTop) || 0;
        const marginBottom = parseFloat(style.marginBottom) || 0;
        return rectHeight + marginTop + marginBottom;
      };

      let currentPageNum = 1;
      let currentPage = createNewPage(currentPageNum);
      const MAX_CONTENT_HEIGHT = 860; // 860px로 여유 공간 최적화

      // 최상위 래퍼 div가 단일로 존재할 경우 내부 자식들을 직접 가져오도록 언래핑
      let children = Array.from(parserDiv.childNodes);
      if (children.length === 1 && children[0].nodeType === Node.ELEMENT_NODE) {
        const firstChild = children[0] as HTMLElement;
        if (firstChild.tagName.toLowerCase() === 'div' || firstChild.tagName.toLowerCase() === 'section') {
          children = Array.from(firstChild.childNodes);
        }
      }
      
      for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) {
          continue;
        }

        const currentPageHasContent = Array.from(currentPage.children).some(
          node => {
            const el = node as HTMLElement;
            return el.className !== 'page-number' && 
                   el.tagName.toLowerCase() !== 'h1' && 
                   el.className !== 'subtitle' && 
                   el.className !== 'pdf-header';
          }
        );

        // 1. 수동 page-break 식별 및 카테고리별(2., 3., 4. 등) 강제 페이지 분할
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          const tagName = el.tagName.toLowerCase();
          
          const isPageBreak = el.className === 'page-break' || el.tagName.toLowerCase() === 'page-break';
          
          let isNewCategory = false;
          if (tagName === 'h2') {
            const text = el.innerText || el.textContent || '';
            isNewCategory = /^([2-9]|\d{2,})\./.test(text.trim());
          }

          if (isPageBreak || (isNewCategory && currentPageHasContent)) {
            currentPageNum++;
            currentPage = createNewPage(currentPageNum);
            if (isPageBreak) {
              continue;
            }
          }
        }

        // 2. 임시 렌더 및 자동 높이 초과 여부 측정
        const clone = child.cloneNode(true) as HTMLElement;
        currentPage.appendChild(clone);
        
        // 브라우저 렌더 트리 강제 갱신(reflow)
        void currentPage.offsetHeight;

        let contentHeight = 0;
        for (const node of Array.from(currentPage.children)) {
          const el = node as HTMLElement;
          if (el.className !== 'page-number') {
            contentHeight += getElementFullHeight(el);
          }
        }

        // 현재 페이지에 포함된 실 콘텐츠 개수 측정 (헤더/페이지 번호 제외)
        const contentChildrenCount = Array.from(currentPage.children).filter(
          node => {
            const el = node as HTMLElement;
            return el.className !== 'page-number' && 
                   el.tagName.toLowerCase() !== 'h1' && 
                   el.className !== 'subtitle' && 
                   el.className !== 'pdf-header';
          }
        ).length;

        // 높이가 기준치를 초과하고 페이지에 이미 콘텐츠가 있는 경우에만 다음 페이지로 넘김
        if (contentHeight > MAX_CONTENT_HEIGHT && contentChildrenCount > 1) {
          currentPage.removeChild(clone);
          currentPageNum++;
          currentPage = createNewPage(currentPageNum);
          currentPage.appendChild(clone);
          void currentPage.offsetHeight;
        }
      }

      // 최종 페이지 번호 텍스트 일괄 갱신 (- 1 / 3 -)
      pages.forEach((page, idx) => {
        const pageNumEl = page.querySelector('.page-number') as HTMLDivElement;
        if (pageNumEl) {
          pageNumEl.innerText = `- ${idx + 1} / ${pages.length} -`;
        }
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        
        const canvas = await html2canvas(pages[i], {
          scale: 2.2,
          useCORS: true,
          width: 794,
          height: 1123,
          windowWidth: 794,
          windowHeight: 1123,
          backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      document.body.removeChild(container);
      pdf.save(filename);
    } catch (err: any) {
      console.error("AI Report PDF Generation Error:", err);
      alert(`PDF 다운로드 실패: ${err.message}`);
    }
  };

  const exportToCSV = (type: 'hardware' | 'software') => {
    let csvData = '';
    if (type === 'hardware') {
      csvData = Papa.unparse(hardware.map(h => ({
        '컴퓨터이름': h.computer_name,
        'IP주소': h.ip_address,
        '운영체제': h.os,
        '프로세서': h.processor,
        '메인보드': h.motherboard,
        '메모리': h.memory,
        '그래픽카드': h.graphic_card,
        '저장장치': h.storage
      })));
    } else {
      csvData = Papa.unparse(software.map(s => ({
        '컴퓨터이름': s.computer_name,
        '프로그램명': s.program_name,
        '프로그램버전': s.program_version,
        '공급자': s.publisher
      })));
    }

    const blob = new Blob(["\uFEFF" + csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${customer?.name}_${type}_inventory.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 하드웨어 대시보드 통계
  const cpuStats = useMemo(() => {
    const counts: Record<string, number> = { 'i3': 0, 'i5': 0, 'i7': 0, 'i9': 0, 'Ryzen 3': 0, 'Ryzen 5': 0, 'Ryzen 7': 0, 'Ryzen 9': 0, '기타': 0 };
    hardware.forEach(h => {
      const cpu = h.processor?.toLowerCase() || '';
      if (cpu.includes('i3')) counts['i3']++;
      else if (cpu.includes('i5')) counts['i5']++;
      else if (cpu.includes('i7')) counts['i7']++;
      else if (cpu.includes('i9')) counts['i9']++;
      else if (cpu.includes('ryzen 3') || cpu.includes('ryzen3')) counts['Ryzen 3']++;
      else if (cpu.includes('ryzen 5') || cpu.includes('ryzen5')) counts['Ryzen 5']++;
      else if (cpu.includes('ryzen 7') || cpu.includes('ryzen7')) counts['Ryzen 7']++;
      else if (cpu.includes('ryzen 9') || cpu.includes('ryzen9')) counts['Ryzen 9']++;
      else counts['기타']++;
    });
    return Object.keys(counts).filter(k => counts[k] > 0).map(k => ({ name: k, count: counts[k] })).sort((a, b) => b.count - a.count);
  }, [hardware]);

  const memoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    hardware.forEach(h => {
      const mem = h.memory || 'Unknown';
      counts[mem] = (counts[mem] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] })).sort((a,b) => b.value - a.value);
  }, [hardware]);

  // 소프트웨어 대시보드 통계
  const commercialSoftware = useMemo(() => {
    const counts: Record<string, number> = { 'MS Office': 0, 'Adobe (포토샵/일러 등)': 0, '한컴오피스': 0, 'AutoCAD': 0 };
    software.forEach(s => {
      const name = (s.program_name + ' ' + (s.publisher||'')).toLowerCase();
      if (name.includes('office') || name.includes('365') || name.includes('excel') || name.includes('word')) counts['MS Office']++;
      else if (name.includes('adobe') || name.includes('photoshop') || name.includes('illustrator') || name.includes('acrobat')) counts['Adobe (포토샵/일러 등)']++;
      else if (name.includes('한컴') || name.includes('hancom') || name.includes('hwp') || name.includes('한글')) counts['한컴오피스']++;
      else if (name.includes('autocad') || name.includes('autodesk')) counts['AutoCAD']++;
    });
    return Object.keys(counts).filter(k => counts[k] > 0).map(k => ({ name: k, value: counts[k] }));
  }, [software]);

  const topSoftware = useMemo(() => {
    const counts: Record<string, number> = {};
    software.forEach(s => {
      if (s.program_name) {
        counts[s.program_name] = (counts[s.program_name] || 0) + 1;
      }
    });
    return Object.keys(counts)
      .map(key => ({ name: key, count: counts[key] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [software]);

  // 소프트웨어 그룹화
  const groupedSoftware = useMemo(() => {
    const groups: Record<string, Software[]> = {};
    software.forEach(sw => {
      if (!groups[sw.computer_name]) groups[sw.computer_name] = [];
      groups[sw.computer_name].push(sw);
    });
    return Object.keys(groups).map(name => ({
      computer_name: name,
      count: groups[name].length,
      softwareList: groups[name]
    })).sort((a, b) => a.computer_name.localeCompare(b.computer_name, undefined, { numeric: true, sensitivity: 'base' }));
  }, [software]);

  // 팝업 내 렌더링될 현재 선택 PC의 소프트웨어 목록
  const currentComputerSoftware = useMemo(() => {
    return software.filter(s => s.computer_name === selectedComputer);
  }, [software, selectedComputer]);

  const sortedHardware = useMemo(() => {
    let sortable = [...hardware];
    if (hwSortConfig !== null) {
      sortable.sort((a, b) => {
        const aVal = String(a[hwSortConfig.key] || '');
        const bVal = String(b[hwSortConfig.key] || '');
        const result = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        return hwSortConfig.direction === 'asc' ? result : -result;
      });
    } else {
      sortable.sort((a, b) => 
        String(a.computer_name || '').localeCompare(String(b.computer_name || ''), undefined, { numeric: true, sensitivity: 'base' })
      );
    }
    return sortable;
  }, [hardware, hwSortConfig]);

  const sortedGroupedSoftware = useMemo(() => {
    let sortable = groupedSoftware.map(group => {
      const hwRecord = hardware.find(h => h.computer_name === group.computer_name);
      return {
        ...group,
        department: hwRecord?.department || '',
        user_name: hwRecord?.user_name || ''
      };
    });
    if (swSortConfig !== null) {
      sortable.sort((a, b) => {
        if (swSortConfig.key === 'count') {
          return swSortConfig.direction === 'asc' ? a.count - b.count : b.count - a.count;
        }
        const aVal = String(a[swSortConfig.key as keyof typeof a] || '');
        const bVal = String(b[swSortConfig.key as keyof typeof b] || '');
        const result = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        return swSortConfig.direction === 'asc' ? result : -result;
      });
    }
    return sortable;
  }, [groupedSoftware, swSortConfig, hardware]);

  const handleHwSort = (key: keyof Hardware) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (hwSortConfig && hwSortConfig.key === key && hwSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setHwSortConfig({ key, direction });
  };

  const handleSwSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (swSortConfig && swSortConfig.key === key && swSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSwSortConfig({ key, direction });
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="lg">
      <Helmet><title>{customer?.name} 인벤토리 | COMTOOIN</title></Helmet>

      <Box sx={{ mb: 2.5, display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' }, gap: 2, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          {userRole !== 'customer' && (
            <IconButton onClick={() => navigate('/admin/customers')} sx={{ bgcolor: 'white', boxShadow: 1, mt: { xs: 0.5, md: 0 } }}>
              <ArrowBackIcon />
            </IconButton>
          )}
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5}>
              <ComputerIcon sx={{ fontSize: '2rem', color: 'primary.main' }} />
              <Typography variant="h5" component="h1" fontWeight="bold">
                {customer?.name} 자산 관리
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              하드웨어 및 소프트웨어 설치 현황 대시보드
            </Typography>
          </Box>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mt: { xs: 2, sm: 0 } }}>
          <Button 
            size="small"
            variant="outlined" 
            startIcon={isGenerating ? <CircularProgress size={14} color="inherit" /> : <AiIcon />}
            onClick={handleGenerateAiReport}
            disabled={isGenerating}
            sx={{ 
              fontWeight: 'bold', 
              color: '#673ab7', 
              borderColor: '#673ab7',
              '&:hover': { bgcolor: 'rgba(103, 58, 183, 0.04)', borderColor: '#512da8' } 
            }}
          >
            AI 자산 분석 리포트
          </Button>
          <Button 
            size="small"
            variant="contained" 
            color="primary" 
            startIcon={<FileDownloadIcon />} 
            onClick={handleDownloadExe}
          >
            자산 수집기 다운로드
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* PC 자산 수집기 안내 */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 3, borderRadius: 2, bgcolor: '#f8fafc', borderLeft: '4px solid #1976d2' }}>
        {/* 데스크톱/태블릿 화면 */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <InfoIcon color="primary" sx={{ fontSize: 18 }} />
              <Typography variant="body2" fontWeight="bold" sx={{ color: 'text.primary', whiteSpace: 'nowrap' }}>
                자산 수집 가이드:
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              1. <strong>[자산 수집기 다운로드]</strong> 버튼 클릭
            </Typography>
            <Typography variant="caption" color="text.secondary">
              2. 파일 실행 (크롬 경고 시 <strong>[다운로드 허용/유지]</strong> 선택)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              3. 완료 시 5초 내 대시보드 실시간 자동 등록
            </Typography>
          </Stack>
        </Box>

        {/* 모바일 화면 */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <InfoIcon color="primary" sx={{ fontSize: 18, flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary">
              수집기 실행은 <strong>Windows PC</strong>에서 가능하며, 완료 시 5초 내에 목록이 자동 등록됩니다.
            </Typography>
          </Stack>
        </Box>
      </Paper>

      {/* 모바일 통계 접기/펼치기 토글 버튼 */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}>
        <Button 
          fullWidth 
          variant="outlined" 
          size="small"
          onClick={() => setShowStats(!showStats)}
          startIcon={<BarChartIcon />}
        >
          {showStats ? '📊 통계 차트 접기' : '📊 통계 차트 펼치기'}
        </Button>
      </Box>

      {/* 맞춤형 동적 대시보드 */}
      <Box sx={{ display: { xs: showStats ? 'block' : 'none', md: 'block' } }}>
        {tabValue === 0 ? (
          <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: { xs: 2, sm: 2.5 } }}>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, height: '250px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="subtitle1" fontWeight="bold" color="text.secondary" gutterBottom>
                  등록된 PC 대수
                </Typography>
                <Typography variant="h2" fontWeight="bold" color="primary.main">
                  {hardware.length}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '250px' }}>
                <Typography variant="subtitle2" fontWeight="bold" align="center" gutterBottom>메모리(RAM) 용량 분포</Typography>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={memoryStats} cx="50%" cy="50%" innerRadius={40} outerRadius={70} fill="#8884d8" paddingAngle={5} dataKey="value" label={(props: any) => `${props.name} (${((props.percent || 0) * 100).toFixed(0)}%)`} labelLine={false} style={{fontSize: '11px'}}>
                      {memoryStats.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '250px' }}>
                <Typography variant="subtitle2" fontWeight="bold" align="center" gutterBottom>CPU 등급별 분포</Typography>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cpuStats} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11}} />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#0288d1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        ) : (
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '250px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="subtitle1" fontWeight="bold" color="text.secondary" gutterBottom>
                  설치된 프로그램 총 건수
                </Typography>
                <Typography variant="h2" fontWeight="bold" color="secondary.main">
                  {software.length}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '250px' }}>
                <Typography variant="subtitle2" fontWeight="bold" align="center" gutterBottom>주요 상용 소프트웨어 설치 현황</Typography>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={commercialSoftware} cx="50%" cy="50%" innerRadius={40} outerRadius={70} fill="#8884d8" paddingAngle={5} dataKey="value" label={(props: any) => `${props.name} (${((props.percent || 0) * 100).toFixed(0)}%)`} labelLine={false} style={{fontSize: '11px', fontWeight: 'bold'}}>
                      {commercialSoftware.map((entry, index) => <Cell key={`cell-${index}`} fill={['#d32f2f', '#1976d2', '#388e3c', '#f57c00'][index % 4]} />)}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '250px' }}>
                <Typography variant="subtitle2" fontWeight="bold" align="center" gutterBottom>전체 Top 5 소프트웨어</Typography>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSoftware} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#607d8b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: { xs: 0, sm: 2 } }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} textColor="primary" indicatorColor="primary" variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            <Tab label={`하드웨어 (${hardware.length})`} sx={{ fontWeight: 'bold' }} />
            <Tab label={`소프트웨어 (${groupedSoftware.length}대)`} sx={{ fontWeight: 'bold' }} />
          </Tabs>
        </Box>

        <Box sx={{ p: 2 }}>
          {/* 하드웨어 탭 */}
          {tabValue === 0 && (
            <Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mb={2} justifyContent="flex-end">
                <>
                  <Button variant="outlined" color="error" startIcon={<DeleteSweepIcon />} size="small" onClick={() => handleDeleteAll('hardware')} sx={{ mr: { sm: 'auto' } }}>
                    전체 초기화
                  </Button>
                  <Button component="label" variant="outlined" startIcon={<FileUploadIcon />} size="small">
                    CSV 업로드
                    <input type="file" hidden accept=".csv" onChange={(e) => handleFileUpload(e, 'hardware')} />
                  </Button>
                </>
                <Button variant="outlined" color="secondary" startIcon={<FileDownloadIcon />} size="small" onClick={() => exportToCSV('hardware')}>
                  엑셀 다운로드
                </Button>
              </Stack>
              <TableContainer sx={{ maxHeight: 500 }} ref={hwTableRef}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {[
                        { id: 'department', label: '부서' },
                        { id: 'user_name', label: '사용자이름' },
                        { id: 'os', label: '운영체제' },
                        { id: 'processor', label: 'CPU' },
                        { id: 'memory', label: '메모리' },
                        { id: 'storage', label: '저장장치' }
                      ].map((col) => (
                        <TableCell key={col.id} sortDirection={hwSortConfig?.key === col.id ? hwSortConfig.direction : false} sx={{ whiteSpace: 'nowrap' }}>
                          <TableSortLabel
                            active={hwSortConfig?.key === col.id}
                            direction={hwSortConfig?.key === col.id ? hwSortConfig.direction : 'asc'}
                            onClick={() => handleHwSort(col.id as keyof Hardware)}
                          >
                            {col.label}
                          </TableSortLabel>
                        </TableCell>
                      ))}
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap', width: 100 }}>관리</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedHardware.length > 0 ? sortedHardware.slice((hwPage - 1) * hwRowsPerPage, (hwPage - 1) * hwRowsPerPage + hwRowsPerPage).map((row) => (
                      <TableRow 
                        key={row.id} 
                        hover 
                        onClick={() => {
                          setSelectedHardware(row);
                          setHwDetailOpen(true);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.department || '-'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.user_name || '-'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.os}</TableCell>
                        <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Tooltip title={row.processor || ''}>
                            <span>{row.processor || '-'}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.memory}</TableCell>
                        <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Tooltip title={row.storage || ''}>
                            <span>{row.storage || '-'}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title="정보 수정">
                            <IconButton 
                              size="small" 
                              color="primary" 
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(row, 'hardware');
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="삭제">
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(row.id, 'hardware');
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={7} align="center" sx={{py:3}}>데이터가 없습니다.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
                {sortedHardware.length > hwRowsPerPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                  <Pagination 
                    count={Math.ceil(sortedHardware.length / hwRowsPerPage)} 
                    page={hwPage} 
                    onChange={(e, newPage) => {
                      setHwPage(newPage);
                      if (hwTableRef.current) hwTableRef.current.scrollTop = 0;
                    }} 
                    color="primary" 
                    size="medium"
                  />
                </Box>
              )}
            </Box>
          )}

          {/* 소프트웨어 탭 (컴퓨터별 그룹화) */}
          {tabValue === 1 && (
            <Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mb={2} justifyContent="flex-end">
                <>
                  <Button variant="outlined" color="error" startIcon={<DeleteSweepIcon />} size="small" onClick={() => handleDeleteAll('software')} sx={{ mr: { sm: 'auto' } }}>
                    전체 초기화
                  </Button>
                  <Button component="label" variant="outlined" startIcon={<FileUploadIcon />} size="small">
                    CSV 업로드
                    <input type="file" hidden accept=".csv" onChange={(e) => handleFileUpload(e, 'software')} />
                  </Button>
                </>
                <Button variant="outlined" color="secondary" startIcon={<FileDownloadIcon />} size="small" onClick={() => exportToCSV('software')}>
                  엑셀 전체 다운로드
                </Button>
              </Stack>
              <TableContainer sx={{ maxHeight: 500 }} ref={swTableRef}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {[
                        { id: 'department', label: '부서' },
                        { id: 'user_name', label: '사용자이름' },
                        { id: 'count', label: '설치된 프로그램 개수' }
                      ].map((col) => (
                        <TableCell 
                          key={col.id}
                          sortDirection={swSortConfig?.key === col.id ? swSortConfig.direction : false} 
                          sx={{ whiteSpace: 'nowrap' }}
                        >
                          <TableSortLabel
                            active={swSortConfig?.key === col.id}
                            direction={swSortConfig?.key === col.id ? swSortConfig.direction : 'asc'}
                            onClick={() => handleSwSort(col.id)}
                          >
                            {col.label}
                          </TableSortLabel>
                        </TableCell>
                      ))}
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: 100 }}>관리</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedGroupedSoftware.length > 0 ? sortedGroupedSoftware.slice((swPage - 1) * swRowsPerPage, (swPage - 1) * swRowsPerPage + swRowsPerPage).map((group) => (
                      <TableRow 
                        key={group.computer_name} 
                        hover 
                        onClick={() => {
                          setSelectedComputer(group.computer_name);
                          setSwDetailPage(1);
                          setSwDetailOpen(true);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{group.department || '-'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{group.user_name || '-'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{group.count} 개</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title="이 PC의 모든 소프트웨어 삭제">
                            <Button 
                              variant="outlined" 
                              color="error" 
                              size="small" 
                              startIcon={<DeleteSweepIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteByComputer(group.computer_name);
                              }}
                            >
                              초기화
                            </Button>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={4} align="center" sx={{py:3}}>소프트웨어 데이터가 없습니다.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
                {sortedGroupedSoftware.length > swRowsPerPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                  <Pagination 
                    count={Math.ceil(sortedGroupedSoftware.length / swRowsPerPage)} 
                    page={swPage} 
                    onChange={(e, newPage) => {
                      setSwPage(newPage);
                      if (swTableRef.current) swTableRef.current.scrollTop = 0;
                    }} 
                    color="primary" 
                    size="medium"
                  />
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* 정보 수정 팝업 (하드웨어/소프트웨어 공통) */}
      <Dialog 
        open={openModal} 
        onClose={() => setOpenModal(false)} 
        maxWidth="sm" 
        fullWidth 
        style={{ zIndex: 1400 }}
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '20px 16px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 40px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 32px)' },
            maxWidth: { xs: 'calc(100% - 32px)', sm: 'sm' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          {modalType === 'hardware' ? (
            <ComputerIcon color="action" sx={{ fontSize: '1.25rem' }} />
          ) : (
            <SettingsIcon color="action" sx={{ fontSize: '1.25rem' }} />
          )}
          <span>{modalType === 'hardware' ? '하드웨어' : '소프트웨어'} 정보 수정</span>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth label="컴퓨터이름" value={formData.computer_name || ''} onChange={(e) => setFormData({...formData, computer_name: e.target.value})} size="small" />
            </Grid>
            {modalType === 'hardware' ? (
              <>
                <Grid item xs={12} sm={6}><TextField fullWidth label="IP주소" value={formData.ip_address || ''} onChange={(e) => setFormData({...formData, ip_address: e.target.value})} size="small" /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="운영체제" value={formData.os || ''} onChange={(e) => setFormData({...formData, os: e.target.value})} size="small" /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="프로세서" value={formData.processor || ''} onChange={(e) => setFormData({...formData, processor: e.target.value})} size="small" /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="메인보드" value={formData.motherboard || ''} onChange={(e) => setFormData({...formData, motherboard: e.target.value})} size="small" /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="메모리" value={formData.memory || ''} onChange={(e) => setFormData({...formData, memory: e.target.value})} size="small" /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="그래픽카드" value={formData.graphic_card || ''} onChange={(e) => setFormData({...formData, graphic_card: e.target.value})} size="small" /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="저장장치" value={formData.storage || ''} onChange={(e) => setFormData({...formData, storage: e.target.value})} size="small" /></Grid>
              </>
            ) : (
              <>
                <Grid item xs={12}><TextField fullWidth label="프로그램명" value={formData.program_name || ''} onChange={(e) => setFormData({...formData, program_name: e.target.value})} size="small" /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="프로그램버전" value={formData.program_version || ''} onChange={(e) => setFormData({...formData, program_version: e.target.value})} size="small" /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="공급자" value={formData.publisher || ''} onChange={(e) => setFormData({...formData, publisher: e.target.value})} size="small" /></Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button variant="contained" color="primary" onClick={handleEditSubmit} sx={{ fontWeight: 'bold' }}>저장</Button>
          <Button onClick={() => setOpenModal(false)} variant="outlined" color="inherit">닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 소프트웨어 상세 목록 팝업 */}
      <Dialog 
        open={swDetailOpen} 
        onClose={() => setSwDetailOpen(false)} 
        maxWidth="md" 
        fullWidth 
        style={{ zIndex: 1300 }}
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '12px 8px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 16px)' },
            maxWidth: { xs: 'calc(100% - 16px)', sm: 'md' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon color="action" sx={{ fontSize: '1.25rem' }} />
          <span>[{selectedComputer}] 설치된 소프트웨어 상세</span>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>프로그램명</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>버전</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>공급자</TableCell>
                  <TableCell align="center" sx={{ width: 100, whiteSpace: 'nowrap' }}>관리</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentComputerSoftware.length > 0 ? currentComputerSoftware.slice((swDetailPage - 1) * swDetailRowsPerPage, (swDetailPage - 1) * swDetailRowsPerPage + swDetailRowsPerPage).map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.program_name}</TableCell>
                    <TableCell>{row.program_version}</TableCell>
                    <TableCell>{row.publisher}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="primary" onClick={() => openEditModal(row, 'software')}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(row.id, 'software')}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={4} align="center" sx={{py:3}}>데이터가 없습니다.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {currentComputerSoftware.length > swDetailRowsPerPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <Pagination 
              count={Math.ceil(currentComputerSoftware.length / swDetailRowsPerPage)} 
              page={swDetailPage} 
              onChange={(e, newPage) => setSwDetailPage(newPage)} 
              color="primary" 
              size="medium"
            />
          </Box>
        )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSwDetailOpen(false)} variant="outlined" color="inherit">닫기</Button>
        </DialogActions>
      </Dialog>
      {/* 하드웨어 상세 정보 팝업 */}
      <Dialog 
        open={hwDetailOpen} 
        onClose={() => setHwDetailOpen(false)} 
        maxWidth="md" 
        fullWidth 
        style={{ zIndex: 1300 }}
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '12px 8px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 16px)' },
            maxWidth: { xs: 'calc(100% - 16px)', sm: 'md' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <ComputerIcon color="action" sx={{ fontSize: '1.25rem' }} />
            <span>하드웨어 상세 사양 정보</span>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {selectedHardware && (
            <Stack spacing={3.5}>
              {/* 기본 정보 섹션 */}
              <Box>
                <Typography variant="subtitle2" color="primary" fontWeight="bold" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <InfoIcon sx={{ fontSize: '1.1rem' }} /> 기본 인프라 정보
                </Typography>
                <Paper variant="outlined" sx={{ borderRadius: 1.5, overflowX: 'auto' }}>
                  <Table size="small">
                    <TableBody>
                      {[
                        { label: '부서', value: selectedHardware.department },
                        { label: '사용자 이름', value: selectedHardware.user_name },
                        { label: '컴퓨터 이름', value: selectedHardware.computer_name, highlight: true },
                        { label: 'IP 주소', value: selectedHardware.ip_address },
                        { label: '운영체제 (OS)', value: selectedHardware.os }
                      ].map((item, idx) => (
                        <TableRow key={idx} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                          <TableCell sx={{ width: 160, fontWeight: 'bold', bgcolor: '#f8fafc', borderRight: '1px solid #e2e8f0', py: 1.2, whiteSpace: 'nowrap' }}>
                            {item.label}
                          </TableCell>
                          <TableCell sx={{ py: 1.2, pl: 2, fontWeight: item.highlight ? 'bold' : 'inherit', whiteSpace: 'nowrap' }}>
                            {item.value || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Box>

              {/* 하드웨어 사양 섹션 */}
              <Box>
                <Typography variant="subtitle2" color="primary" fontWeight="bold" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ComputerIcon sx={{ fontSize: '1.1rem' }} /> 상세 하드웨어 스펙
                </Typography>
                <Paper variant="outlined" sx={{ borderRadius: 1.5, overflowX: 'auto' }}>
                  <Table size="small">
                    <TableBody>
                      {[
                        { label: '프로세서 (CPU)', value: selectedHardware.processor },
                        { label: '메인보드 (Motherboard)', value: selectedHardware.motherboard },
                        { label: '메모리 (RAM)', value: selectedHardware.memory },
                        { label: '그래픽카드 (GPU)', value: selectedHardware.graphic_card },
                        { 
                          label: '저장장치 (Storage)', 
                          value: selectedHardware.storage ? (
                            <Stack spacing={0.5}>
                              {selectedHardware.storage.split(',').map((drive, idx) => {
                                const trimmedDrive = drive.trim();
                                const isCDrive = trimmedDrive.includes('[C드라이브]');
                                return (
                                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                                    {isCDrive ? (
                                      <span style={{ color: '#1976d2', fontWeight: 'bold' }}>{trimmedDrive}</span>
                                    ) : (
                                      <span style={{ color: '#475569' }}>{trimmedDrive}</span>
                                    )}
                                  </Box>
                                );
                              })}
                            </Stack>
                          ) : '-' 
                        }
                      ].map((item, idx) => (
                        <TableRow key={idx} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                          <TableCell sx={{ width: 160, fontWeight: 'bold', bgcolor: '#f8fafc', borderRight: '1px solid #e2e8f0', py: 1.2, whiteSpace: 'nowrap' }}>
                            {item.label}
                          </TableCell>
                          <TableCell sx={{ py: 1.2, pl: 2, whiteSpace: 'nowrap' }}>
                            {item.value}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 1.5, sm: 2 }, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          {selectedHardware ? (
            <Button 
              variant="outlined" 
              color="error" 
              size="small"
              onClick={async () => {
                const success = await handleDelete(selectedHardware.id, 'hardware');
                if (success) {
                  setHwDetailOpen(false);
                }
              }}
            >
              삭제
            </Button>
          ) : <Box />}
          <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
            {selectedHardware && (
              <Button 
                variant="contained" 
                color="primary" 
                size="small"
                onClick={() => {
                  setHwDetailOpen(false);
                  openEditModal(selectedHardware, 'hardware');
                }}
                sx={{ fontWeight: 'bold' }}
              >
                수정
              </Button>
            )}
            <Button variant="outlined" color="inherit" size="small" onClick={() => setHwDetailOpen(false)} sx={{ bgcolor: 'white' }}>닫기</Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* AI 리포트 모달 */}
      <Dialog 
        open={aiModalOpen} 
        onClose={() => setAiModalOpen(false)} 
        maxWidth="lg" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '12px 8px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 16px)' },
            maxWidth: { xs: 'calc(100% - 16px)', sm: 'lg' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AiIcon color="action" sx={{ fontSize: '1.25rem' }} /> AI 자산 분석 리포트 미리보기 (A4 레이아웃)
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, bgcolor: '#f1f5f9' }}>
          <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, overflowY: 'auto', maxHeight: '70vh' }}>
            {previewPages.map((pageHtml, idx) => (
              <Paper 
                key={idx}
                elevation={3}
                sx={{ 
                  width: '794px',
                  height: '1123px',
                  bgcolor: '#ffffff',
                  padding: '60px 50px 80px 50px',
                  boxSizing: 'border-box',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif",
                  color: '#333333',
                  flexShrink: 0,
                  transformOrigin: 'top center',
                  '@media (max-width: 850px)': {
                    transform: 'scale(0.8)',
                    mb: -25
                  },
                  '@media (max-width: 600px)': {
                    transform: 'scale(0.5)',
                    mb: -56
                  },
                  '& h1': { fontSize: '24px', fontWeight: 'bold', textAlign: 'center', mb: 1, color: '#111' },
                  '& .subtitle': { fontSize: '12px', textAlign: 'center', mb: 4, color: '#666666', borderBottom: '2px solid #673ab7', pb: 2 },
                  '& .pdf-header': { fontSize: '11px', color: '#999', borderBottom: '1px solid #eee', pb: 1, mb: 3 },
                  '& h2': { fontSize: '18px', fontWeight: 'bold', mt: 4, mb: 2, color: '#673ab7', borderBottom: '1px solid #ddd', pb: 1 },
                  '& h3': { fontSize: '14px', fontWeight: 'bold', mt: 2.5, mb: 1.5, color: '#333' },
                  '& p': { fontSize: '14px', lineHeight: 1.85, mb: 2, textAlign: 'justify' },
                  '& ul': { pl: 2.5, mb: 2, fontSize: '14px', lineHeight: 1.85 },
                  '& li': { mb: 1 },
                  '& table': { width: '100%', borderCollapse: 'collapse', my: 2.5, fontSize: '13px' },
                  '& th': { bgcolor: '#f5f5f5', border: '1px solid #ddd', p: 1.5, fontWeight: 'bold', textAlign: 'center' },
                  '& td': { border: '1px solid #ddd', p: 1.5, lineHeight: 1.6 }
                }}
              >
                {/* Content */}
                <Box sx={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: pageHtml }} />

                {/* Page Number */}
                <Box 
                  sx={{ 
                    position: 'absolute',
                    bottom: '30px',
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontSize: '11px',
                    color: '#999999'
                  }}
                >
                  - {idx + 1} / {previewPages.length} -
                </Box>
              </Paper>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
          <Button onClick={handleDownloadAiReport} variant="contained" color="success" sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' }, m: '0 !important' }}>
            PC에 다운로드 (PDF)
          </Button>
          <Button 
            variant="contained" 
            color="secondary"
            onClick={() => {
              // HTML 태그 제거하여 텍스트만 복사
              const tempElement = document.createElement('div');
              tempElement.innerHTML = aiReportContent;
              navigator.clipboard.writeText(tempElement.innerText || tempElement.textContent || '');
              alert('리포트 내용이 클립보드에 복사되었습니다.');
            }}
            sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' }, m: '0 !important' }}
          >
            내용 복사
          </Button>
          <Button onClick={() => setAiModalOpen(false)} color="inherit" variant="outlined" sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' }, m: '0 !important' }}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminCustomerInventoryPage;
