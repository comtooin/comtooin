import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Typography, Box, Paper, Stack, Button, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, IconButton, Grid, Dialog, DialogTitle, DialogContent, DialogActions, TextField, TablePagination, Tooltip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  FileUpload as FileUploadIcon,
  FileDownload as FileDownloadIcon,
  Computer as ComputerIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
  DeleteSweep as DeleteSweepIcon,
  AutoAwesome as AiIcon
} from '@mui/icons-material';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';
import Papa from 'papaparse';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Hardware {
  id: string;
  computer_name: string;
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

  // 정보 수정 모달 상태
  const [openModal, setOpenModal] = useState(false);
  const [modalType, setModalType] = useState<'hardware' | 'software'>('hardware');
  const [formData, setFormData] = useState<any>({});

  // 페이징 상태
  const [hwPage, setHwPage] = useState(0);
  const [hwRowsPerPage, setHwRowsPerPage] = useState(10);
  const [swPage, setSwPage] = useState(0);
  const [swRowsPerPage, setSwRowsPerPage] = useState(15);
  
  // 소프트웨어 상세보기 팝업 상태
  const [swDetailOpen, setSwDetailOpen] = useState(false);
  const [selectedComputer, setSelectedComputer] = useState<string>('');
  const [swDetailPage, setSwDetailPage] = useState(0);
  const [swDetailRowsPerPage, setSwDetailRowsPerPage] = useState(10);

  useEffect(() => {
    if (id) fetchInventoryData();
  }, [id]);

  const fetchInventoryData = async () => {
    setLoading(true);
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
        .eq('customer_id', id)
        .order('computer_name', { ascending: true });
      if (hwError) throw hwError;
      setHardware(hwData || []);

      // 3. 소프트웨어 목록
      const { data: swData, error: swError } = await supabase
        .from('customer_software')
        .select('*')
        .eq('customer_id', id)
        .order('computer_name', { ascending: true });
      if (swError) throw swError;
      setSoftware(swData || []);

    } catch (err: any) {
      setError(err.message || '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
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
      
      setSuccess('정보 수정이 정상적으로 완료되었습니다.');
      setOpenModal(false);
      fetchInventoryData(); // 새로고침
    } catch (err: any) {
      setError(`정보 수정 실패: ${err.message}`);
    }
  };

  const handleDelete = async (itemId: string, type: 'hardware' | 'software') => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const table = type === 'hardware' ? 'customer_hardware' : 'customer_software';
      const { error: delError } = await supabase.from(table).delete().eq('id', itemId);
      if (delError) throw delError;
      
      if (type === 'hardware') setHardware(prev => prev.filter(h => h.id !== itemId));
      else setSoftware(prev => prev.filter(s => s.id !== itemId));
    } catch (err: any) {
      setError(`삭제 실패: ${err.message}`);
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
        `이 데이터를 바탕으로 고객사에게 제공할 전문적인 '자산 현황 분석 리포트'를 작성해주세요. ` +
        `인프라 총평, 주요 스펙 현황, 보안 및 라이선스 관점의 권장 사항(메모리 업그레이드 권장 등)을 포함해 주시기 바랍니다. 출력은 마크다운(HTML 태그 없는) 텍스트로 해주세요.`;

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

      setAiReportContent(data.report || data.content || JSON.stringify(data));
      setAiModalOpen(true);
    } catch (err: any) {
      console.error("AI Report Generation Error:", err);
      setError(`AI 리포트 생성 실패: ${err.message}`);
    } finally {
      setIsGenerating(false);
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
    })).sort((a, b) => a.computer_name.localeCompare(b.computer_name));
  }, [software]);

  // 팝업 내 렌더링될 현재 선택 PC의 소프트웨어 목록
  const currentComputerSoftware = useMemo(() => {
    return software.filter(s => s.computer_name === selectedComputer);
  }, [software, selectedComputer]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="lg">
      <Helmet><title>{customer?.name} 인벤토리 | COMTOOIN</title></Helmet>

      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/admin/customers')} sx={{ bgcolor: 'white', boxShadow: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5}>
              <ComputerIcon sx={{ fontSize: '2rem', color: 'primary.main' }} />
              <Typography variant="h5" component="h1" fontWeight="bold">
                {customer?.name} 인프라 현황
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              하드웨어 및 소프트웨어 설치 현황 대시보드
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button 
            variant="outlined" 
            color="secondary" 
            startIcon={isGenerating ? <CircularProgress size={14} color="inherit" /> : <AiIcon />}
            onClick={handleGenerateAiReport}
            disabled={isGenerating}
            sx={{ fontWeight: 'bold', color: '#673ab7', borderColor: '#673ab7', '&:hover': { bgcolor: 'rgba(103, 58, 183, 0.04)', borderColor: '#512da8' } }}
          >
            AI 자산 분석 리포트
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<FileDownloadIcon />} 
            href="/comtooin_scanner.hta" 
            download
          >
            조사용 프로그램 다운로드
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* 맞춤형 동적 대시보드 */}
      {tabValue === 0 ? (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 1, height: '250px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', bgcolor: '#f8fafc' }}>
              <Typography variant="subtitle1" fontWeight="bold" color="text.secondary" gutterBottom>
                등록된 PC 대수
              </Typography>
              <Typography variant="h2" fontWeight="bold" color="primary.main">
                {hardware.length}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 1, height: '250px' }}>
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
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 1, height: '250px' }}>
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
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 1, height: '250px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', bgcolor: '#f8fafc' }}>
              <Typography variant="subtitle1" fontWeight="bold" color="text.secondary" gutterBottom>
                설치된 프로그램 총 건수
              </Typography>
              <Typography variant="h2" fontWeight="bold" color="secondary.main">
                {software.length}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 1, height: '250px' }}>
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
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 1, height: '250px' }}>
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

      <Paper variant="outlined" sx={{ borderRadius: 1 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} textColor="primary" indicatorColor="primary">
            <Tab label={`하드웨어 (${hardware.length})`} sx={{ fontWeight: 'bold' }} />
            <Tab label={`소프트웨어 (${groupedSoftware.length}대)`} sx={{ fontWeight: 'bold' }} />
          </Tabs>
        </Box>

        <Box sx={{ p: 2 }}>
          {/* 하드웨어 탭 */}
          {tabValue === 0 && (
            <Box>
              <Stack direction="row" spacing={2} mb={2} justifyContent="flex-end">
                <Button variant="outlined" color="error" startIcon={<DeleteSweepIcon />} size="small" onClick={() => handleDeleteAll('hardware')} sx={{ mr: 'auto' }}>
                  전체 초기화
                </Button>
                <Button component="label" variant="outlined" startIcon={<FileUploadIcon />} size="small">
                  CSV 업로드
                  <input type="file" hidden accept=".csv" onChange={(e) => handleFileUpload(e, 'hardware')} />
                </Button>
                <Button variant="outlined" color="secondary" startIcon={<FileDownloadIcon />} size="small" onClick={() => exportToCSV('hardware')}>
                  엑셀 다운로드
                </Button>
              </Stack>
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>컴퓨터이름</TableCell>
                      <TableCell>IP주소</TableCell>
                      <TableCell>운영체제</TableCell>
                      <TableCell>프로세서</TableCell>
                      <TableCell>메인보드</TableCell>
                      <TableCell>메모리</TableCell>
                      <TableCell>그래픽카드</TableCell>
                      <TableCell>저장장치</TableCell>
                      <TableCell align="center">관리</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {hardware.length > 0 ? hardware.slice(hwPage * hwRowsPerPage, hwPage * hwRowsPerPage + hwRowsPerPage).map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell sx={{ fontWeight: 'bold' }}>{row.computer_name}</TableCell>
                        <TableCell>{row.ip_address}</TableCell>
                        <TableCell>{row.os}</TableCell>
                        <TableCell>{row.processor}</TableCell>
                        <TableCell>{row.motherboard}</TableCell>
                        <TableCell>{row.memory}</TableCell>
                        <TableCell>{row.graphic_card}</TableCell>
                        <TableCell>{row.storage}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="primary" onClick={() => openEditModal(row, 'hardware')}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDelete(row.id, 'hardware')}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={9} align="center" sx={{py:3}}>데이터가 없습니다.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50]}
                component="div"
                count={hardware.length}
                rowsPerPage={hwRowsPerPage}
                page={hwPage}
                onPageChange={(e, newPage) => setHwPage(newPage)}
                onRowsPerPageChange={(e) => { setHwRowsPerPage(parseInt(e.target.value, 10)); setHwPage(0); }}
                labelRowsPerPage="페이지당 줄수:"
              />
            </Box>
          )}

          {/* 소프트웨어 탭 (컴퓨터별 그룹화) */}
          {tabValue === 1 && (
            <Box>
              <Stack direction="row" spacing={2} mb={2} justifyContent="flex-end">
                <Button variant="outlined" color="error" startIcon={<DeleteSweepIcon />} size="small" onClick={() => handleDeleteAll('software')} sx={{ mr: 'auto' }}>
                  전체 초기화
                </Button>
                <Button component="label" variant="outlined" startIcon={<FileUploadIcon />} size="small">
                  CSV 업로드
                  <input type="file" hidden accept=".csv" onChange={(e) => handleFileUpload(e, 'software')} />
                </Button>
                <Button variant="outlined" color="secondary" startIcon={<FileDownloadIcon />} size="small" onClick={() => exportToCSV('software')}>
                  엑셀 전체 다운로드
                </Button>
              </Stack>
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '40%' }}>컴퓨터 이름</TableCell>
                      <TableCell sx={{ width: '30%' }}>설치된 프로그램 개수</TableCell>
                      <TableCell align="right" sx={{ width: '30%' }}>관리</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {groupedSoftware.length > 0 ? groupedSoftware.slice(swPage * swRowsPerPage, swPage * swRowsPerPage + swRowsPerPage).map((group) => (
                      <TableRow key={group.computer_name} hover>
                        <TableCell sx={{ fontWeight: 'bold' }}>{group.computer_name}</TableCell>
                        <TableCell>{group.count} 개</TableCell>
                        <TableCell align="right">
                          <Tooltip title="상세 목록 보기">
                            <Button 
                              variant="outlined" 
                              size="small" 
                              startIcon={<OpenInNewIcon />}
                              onClick={() => {
                                setSelectedComputer(group.computer_name);
                                setSwDetailPage(0);
                                setSwDetailOpen(true);
                              }}
                              sx={{ mr: 1 }}
                            >
                              상세보기
                            </Button>
                          </Tooltip>
                          <Tooltip title="이 PC의 모든 소프트웨어 삭제">
                            <Button 
                              variant="outlined" 
                              color="error" 
                              size="small" 
                              startIcon={<DeleteSweepIcon />}
                              onClick={() => handleDeleteByComputer(group.computer_name)}
                            >
                              일괄 삭제
                            </Button>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={3} align="center" sx={{py:3}}>소프트웨어 데이터가 없습니다.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[15, 30, 50]}
                component="div"
                count={groupedSoftware.length}
                rowsPerPage={swRowsPerPage}
                page={swPage}
                onPageChange={(e, newPage) => setSwPage(newPage)}
                onRowsPerPageChange={(e) => { setSwRowsPerPage(parseInt(e.target.value, 10)); setSwPage(0); }}
                labelRowsPerPage="페이지당 줄수:"
              />
            </Box>
          )}
        </Box>
      </Paper>

      {/* 정보 수정 팝업 (하드웨어/소프트웨어 공통) */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="sm" fullWidth style={{ zIndex: 1400 }}>
        <DialogTitle>{modalType === 'hardware' ? '하드웨어' : '소프트웨어'} 정보 수정</DialogTitle>
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
        <DialogActions>
          <Button onClick={() => setOpenModal(false)}>취소</Button>
          <Button variant="contained" onClick={handleEditSubmit}>저장</Button>
        </DialogActions>
      </Dialog>

      {/* 소프트웨어 상세 목록 팝업 */}
      <Dialog open={swDetailOpen} onClose={() => setSwDetailOpen(false)} maxWidth="md" fullWidth style={{ zIndex: 1300 }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>[{selectedComputer}] 설치된 소프트웨어 상세</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>프로그램명</TableCell>
                  <TableCell>버전</TableCell>
                  <TableCell>공급자</TableCell>
                  <TableCell align="center" sx={{ width: 100 }}>관리</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentComputerSoftware.length > 0 ? currentComputerSoftware.slice(swDetailPage * swDetailRowsPerPage, swDetailPage * swDetailRowsPerPage + swDetailRowsPerPage).map((row) => (
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
          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={currentComputerSoftware.length}
            rowsPerPage={swDetailRowsPerPage}
            page={swDetailPage}
            onPageChange={(e, newPage) => setSwDetailPage(newPage)}
            onRowsPerPageChange={(e) => { setSwDetailRowsPerPage(parseInt(e.target.value, 10)); setSwDetailPage(0); }}
            labelRowsPerPage="페이지당 줄수:"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSwDetailOpen(false)} variant="contained" color="inherit">닫기</Button>
        </DialogActions>
      </Dialog>
      {/* AI 리포트 모달 */}
      <Dialog open={aiModalOpen} onClose={() => setAiModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AiIcon color="secondary" /> AI 자산 분석 리포트
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.95rem' }}>
            {aiReportContent}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAiModalOpen(false)} color="inherit" variant="outlined">닫기</Button>
          <Button 
            variant="contained" 
            color="secondary"
            onClick={() => {
              navigator.clipboard.writeText(aiReportContent);
              alert('리포트 내용이 클립보드에 복사되었습니다.');
            }}
          >
            내용 복사
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminCustomerInventoryPage;
