import React, { useState, useRef, useEffect } from 'react';
import ExcelJS from 'exceljs';
import {
  Container, Typography, Box, Paper, TextField, Button, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Grid, Divider, InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, ListItemButton, Collapse, Stack
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AddIcon from '@mui/icons-material/Add';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';

interface QuoteItem {
  id: string;
  category: string;
  name: string;
  quantity: number;
  costPrice: number;
  marginRate: number;
  finalPrice: number;
}

const AdminQuotePage: React.FC = () => {
  const [rawText, setRawText] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [globalMargin, setGlobalMargin] = useState<number>(15);
  const [customerName, setCustomerName] = useState<string>('');
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isSaving, setIsSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeTab, setActiveTab] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Template States
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data } = await supabase.from('staff').select('*').eq('auth_user_id', session.user.id).single();
        if (data) setCurrentUser(data);
      }
    };
    fetchUser();
  }, []);

  // Parse Raw Text
  const handleParse = () => {
    if (!rawText.trim()) return;
    
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l !== '');
    const parsedItems: QuoteItem[] = [];
    let currentCategory = '';
    let parsedWithCart = false;

    // 1. 장바구니 패턴 분석 시도 (컴퓨존, 조이젠 등)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Computoz 옵션 라인 스킵
      if (i > 0 && lines[i - 1] === '상   품 :') continue;

      // [카테고리] 형태의 짧은 라인 감지
      if (line.startsWith('[') && line.endsWith(']') && line.length < 25 && !line.includes(' ') && 
          !line.includes('전자') && !line.includes('마이크로') && !line.includes('MSI') && 
          !line.includes('AMD') && !line.includes('MANLI') && !line.includes('GIGABYTE')) {
        currentCategory = line.slice(1, -1);
        continue;
      }

      // 상품명으로 보이는 라인 감지 (대괄호로 시작하고 일정 길이 이상)
      if (line.startsWith('[') && line.includes(']') && line.length > 10) {
        const name = line.trim();
        let costPrice = 0;
        let quantity = 1;
        let foundPrice = false;
        let foundQty = false;

        // 이후 최대 8줄 탐색하며 가격과 수량 매칭
        for (let j = 1; j <= 8; j++) {
          if (i + j >= lines.length) break;
          const subLine = lines[i + j].trim();

          if (subLine === '변경' || subLine === '상   품 :' || subLine.includes('수량추가수량제거') || 
              subLine === '바로구매' || subLine === '좋아요' || subLine.includes('보관하기') || 
              subLine.includes('계속 보관하기')) {
            continue;
          }

          if (!foundPrice && (subLine.includes('원') || subLine.includes(',')) && /[0-9,]{4,}/.test(subLine)) {
            const numStr = subLine.replace(/[^0-9]/g, '');
            if (numStr) {
              costPrice = parseInt(numStr);
              foundPrice = true;
            }
          } else if (!foundQty && /^[0-9]+$/.test(subLine) && parseInt(subLine) < 100) {
            quantity = parseInt(subLine);
            foundQty = true;
          }
        }

        if (foundPrice) {
          parsedItems.push({
            id: Date.now().toString() + Math.random().toString(),
            category: currentCategory,
            name: name.replace(/^\[[a-zA-Z0-9_-]+\]\s*/, '').replace(/\s*-\d+\s*$/, '').trim(),
            costPrice,
            quantity,
            marginRate: globalMargin,
            finalPrice: 0,
          });
          parsedWithCart = true;
        }
      }
    }

    // 2. 장바구니 패턴으로 매칭된 건이 없으면 기존 Tab 분리 및 원가 패턴 분석 실행
    if (!parsedWithCart) {
      let buffer = '';
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // 탭 구분선 처리
        if (line.includes('\t')) {
          const parts = line.split('\t').map(p => p.trim()).filter(p => p !== '');
          if (parts.length >= 4) {
            const priceStr = parts[parts.length - 3].replace(/[^0-9]/g, '');
            const qtyStr = parts[parts.length - 2].replace(/[^0-9]/g, '');
            if (priceStr && qtyStr && parseInt(priceStr) > 0) {
              let category = parts[1] || '';
              let name = parts.slice(2, parts.length - 3).join(' ');
              if (parts.length === 4) {
                category = '';
                name = parts[0];
              }
              name = name.replace(/^\[[a-zA-Z0-9_-]+\]\s*/, '').replace(/\s*-\d+\s*$/, '').trim();
              parsedItems.push({
                id: Date.now().toString() + Math.random().toString(),
                category,
                name,
                costPrice: parseInt(priceStr),
                quantity: parseInt(qtyStr) || 1,
                marginRate: globalMargin,
                finalPrice: 0,
              });
              continue;
            }
          }
        }

        // 공백/줄바꿈 패턴 결합 처리
        buffer += (buffer ? ' ' : '') + line;
        const match = buffer.match(/(.*?)\s+([0-9,]+)\s*원?\s+([0-9]+)\s+([0-9,]+)\s*원?$/);
        if (match) {
          const prefix = match[1];
          const costPrice = parseInt(match[2].replace(/,/g, ''));
          const quantity = parseInt(match[3]);

          const prefixParts = prefix.split(' ');
          let category = '';
          let name = prefix;
          if (prefixParts.length >= 3 && !isNaN(parseInt(prefixParts[0]))) {
            category = prefixParts[1];
            name = prefixParts.slice(2).join(' ');
          } else if (prefixParts.length >= 2 && !isNaN(parseInt(prefixParts[0]))) {
            category = '';
            name = prefixParts.slice(1).join(' ');
          }
          name = name.replace(/^\[[a-zA-Z0-9_-]+\]\s*/, '').replace(/\s*-\d+\s*$/, '').trim();

          parsedItems.push({
            id: Date.now().toString() + Math.random().toString(),
            category,
            name,
            costPrice,
            quantity,
            marginRate: globalMargin,
            finalPrice: 0,
          });
          buffer = '';
        }
      }
    }

    const recalculated = parsedItems.map(item => ({
      ...item,
      finalPrice: Math.round(item.costPrice * (1 + item.marginRate / 100) / 10) * 10
    }));

    setItems(recalculated);
    setRawText('');
    setPasteDialogOpen(false);
  };

  const handleGlobalMarginApply = () => {
    setItems(prev => prev.map(item => ({
      ...item,
      marginRate: globalMargin,
      finalPrice: Math.round(item.costPrice * (1 + globalMargin / 100) / 10) * 10
    })));
  };

  const handleItemMarginChange = (id: string, newMargin: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          marginRate: newMargin,
          finalPrice: Math.round(item.costPrice * (1 + newMargin / 100) / 10) * 10
        };
      }
      return item;
    }));
  };

  const handleItemRemove = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleItemFieldChange = (id: string, field: 'category' | 'name', value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleItemQuantityChange = (id: string, value: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantity: value } : item));
  };

  const handleItemCostPriceChange = (id: string, value: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          costPrice: value,
          finalPrice: Math.round(value * (1 + item.marginRate / 100) / 10) * 10
        };
      }
      return item;
    }));
  };

  const handleAddItemManually = () => {
    const newItem: QuoteItem = {
      id: Date.now().toString() + Math.random().toString(),
      category: '',
      name: '',
      quantity: 1,
      costPrice: 0,
      marginRate: globalMargin,
      finalPrice: 0,
    };
    setItems(prev => [...prev, newItem]);
  };

 const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    
    const element = printRef.current;
    
    // Clone the element for rendering off-screen to avoid mobile flexbox shrinking/wrapping issues
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Style the clone to be exactly A4 dimensions and positioned off-screen
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    clone.style.width = '794px';
    clone.style.minHeight = '1123px';
    clone.style.height = '1123px';
    clone.style.margin = '0px';
    clone.style.padding = '32px';
    clone.style.boxSizing = 'border-box';
    clone.style.backgroundColor = '#ffffff';
    
    document.body.appendChild(clone);
    
    try {
      // 스크롤 오류 방지를 위해 임시 최상단 이동
      window.scrollTo(0, 0);

      const canvas = await html2canvas(clone, { 
        scale: 2,           // 고화질
        useCORS: true, 
        width: 794,         // 캡처할 박스의 가로를 딱 794px로 칼같이 도려냄
        height: 1123,       // 세로도 딱 A4 높이인 1123px로 고정
        windowWidth: 794,   // 가상 브라우저 너비를 794px로 속여 우측 여백 발생 차단
        windowHeight: 1123,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: '#ffffff' // 배경을 하얗게 채워 투명화 방지
      });

      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const dateStr = format(new Date(), 'yyyyMMdd');
      const filename = `컴투인_견적서_${customerName || '고객'}_${dateStr}.pdf`;
      
      pdf.save(filename);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('PDF 생성에 실패했습니다.');
    } finally {
      // 캡처 완료 후 클론 제거
      document.body.removeChild(clone);
    }
  };

  const handleDownloadExcel = async () => {
    if (items.length === 0) return;

    const fileName = `컴투인_견적서_${customerName || '고객'}_${format(new Date(), 'yyyyMMdd')}.xlsx`;

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('견적서', {
        views: [{ showGridLines: false }]
      });

      // 1. 이미지 로드용 헬퍼 비동기 함수
      const loadImage = async (url: string): Promise<ArrayBuffer> => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load image: ${url}`);
        return await response.arrayBuffer();
      };

      // 2. 18개 미세 컬럼(A~R) 생성 및 너비 지정 (그리드 분할 및 가로 마진 확장 기법)
      worksheet.columns = Array.from({ length: 18 }, (_, i) => ({
        key: String.fromCharCode(65 + i),
        width: 6.5
      }));

      // 3. 대제목 '견 적 서' 행 작성 (동적 행 추적)
      const titleRow = worksheet.addRow(['견 적 서', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
      titleRow.height = 60;
      const tRowIdx = titleRow.number;
      worksheet.mergeCells(`A${tRowIdx}:R${tRowIdx}`);
      const titleCell = worksheet.getCell(`A${tRowIdx}`);
      titleCell.font = { name: '맑은 고딕', size: 20, bold: true };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // 3.1. 상단 사명 로고 이미지 가져오기 및 삽입
      try {
        const logoBuffer = await loadImage('/comtooin_logo.jpg');
        const logoId = workbook.addImage({
          buffer: logoBuffer,
          extension: 'jpeg'
        });
        // 대제목 행 A~D열 부근에 로고 얹기
        worksheet.addImage(logoId, {
          tl: { col: 0.15, row: tRowIdx - 1 + 0.1 },
          ext: { width: 130, height: 48 }
        });
      } catch (err) {
        console.warn('Excel Logo Image Loading Bypass:', err);
      }

      // 2행: 빈행
      const spaceRow1 = worksheet.addRow([]);
      spaceRow1.height = 12;

      // 3행 ~ 8행: 공급받는자 / 공급자 영역 로우 조립 (18개 그리드 구조)
      const dateStr = format(new Date(), 'yyyy년 MM월 dd일');
      
      // 3행 (수신 | 값 | 공급자 세로 | 등록번호 | 값)
      const row3 = worksheet.addRow(['수 신', '', '', '', `${customerName || ''} 귀하`, '', '', '', '', '공\n급\n자', '등록번호', '', '108-17-56709', '', '', '', '', '']);
      // 4행 (견적일자 | 값 | 공급자 | 상호 | 값 | 성명 | 값 | 도장용빈셀)
      const row4 = worksheet.addRow(['견적일자', '', '', '', dateStr, '', '', '', '', '', '상호(명칭)', '', '컴투인', '', '', '성 명', '김종범', '']);
      // 5행 (유효기간 | 값 | 공급자 | 주소 | 값)
      const row5 = worksheet.addRow(['유효기간', '', '', '', '견적일로부터 7일', '', '', '', '', '', '사업장주소', '', '경기도 의정부시 신촌로63번길42 501호', '', '', '', '', '']);
      // 6행 (아래와같이 | 공급자 | 업태 | 값 | 종목 | 값)
      const row6 = worksheet.addRow(['아래와 같이 견적합니다.', '', '', '', '', '', '', '', '', '', '업 태', '', '도소매', '', '종 목', '컴퓨터 및 주변기기', '', '']);
      // 7행 (합계금액 | 값 | 공급자 | 담당자 | 값)
      const row7 = worksheet.addRow(['합계금액\n(VAT포함)', '', `${Math.round(totalFinal * 1.1).toLocaleString()} 원`, '', '', '', '', '', '', '', '담당자', '', currentUser?.name || '관리자', '', '', '', '', '']);
      // 8행 (빈칸 | 값 | 공급자 | 연락처 | 값 | 이메일 | 값)
      const row8 = worksheet.addRow(['', '', '', '', '', '', '', '', '', '', '연락처', '', currentUser?.phone || '-', '', '이메일', currentUser?.email || '-', '', '']);

      const startRow = row3.number; 
      const endRow = row8.number;   

      // 18개 그리드 기반 정밀 셀 병합(Merge) 규칙 실행
      worksheet.mergeCells(`A${startRow}:D${startRow}`); // 수신 타이틀
      worksheet.mergeCells(`E${startRow}:I${startRow}`); // 수신 귀하 값
      worksheet.mergeCells(`J${startRow}:J${endRow}`);     // 공급자 세로 표기 병합 (J열)
      worksheet.mergeCells(`K${startRow}:L${startRow}`); // 등록번호 타이틀
      worksheet.mergeCells(`M${startRow}:R${startRow}`); // 등록번호 값 (6칸 병합으로 짤림 제로!)

      worksheet.mergeCells(`A${row4.number}:D${row4.number}`); // 견적일자 타이틀
      worksheet.mergeCells(`E${row4.number}:I${row4.number}`); // 견적일자 값
      worksheet.mergeCells(`K${row4.number}:L${row4.number}`); // 상호 타이틀 (2칸 병합으로 상호(명칭) 짤림 방어!)
      worksheet.mergeCells(`M${row4.number}:O${row4.number}`); // 상호 값 (3칸 병합으로 컴투인 수용)
      // P4는 성명 타이틀(1칸), Q4는 김종범(1칸), R4는 도장칸(1칸)으로 배치!

      worksheet.mergeCells(`A${row5.number}:D${row5.number}`); // 유효기간 타이틀
      worksheet.mergeCells(`E${row5.number}:I${row5.number}`); // 유효기간 값
      worksheet.mergeCells(`K${row5.number}:L${row5.number}`); // 주소 타이틀 (2칸)
      worksheet.mergeCells(`M${row5.number}:R${row5.number}`); // 주소 값 (6칸 병합으로 주소 짤림 방어!)

      worksheet.mergeCells(`A${row6.number}:I${row6.number}`); // 아래와 같이 견적합니다
      worksheet.mergeCells(`K${row6.number}:L${row6.number}`); // 업태 타이틀 (2칸)
      worksheet.mergeCells(`M${row6.number}:N${row6.number}`); // 업태 값 (L6 대신 M6:N6 병합하여 도소매 2칸 수용!)
      worksheet.mergeCells(`P${row6.number}:R${row6.number}`); // 종목 값 병합 (3칸 병합하여 컴퓨터 및 주변기기 수용)
      // O6은 종목 타이틀 (1칸)

      worksheet.mergeCells(`A${row7.number}:B${row8.number}`); // 합계금액 / (VAT포함) 가로 2칸 및 세로 2행 전격 병합!
      worksheet.mergeCells(`C${row7.number}:I${row8.number}`); // 합계금액 값 영역 가로 7칸 및 세로 2행 전체 병합!
      worksheet.mergeCells(`K${row7.number}:L${row7.number}`); // 담당자 타이틀 (2칸)
      worksheet.mergeCells(`M${row7.number}:R${row7.number}`); // 담당자 값 (6칸)

      worksheet.mergeCells(`K${row8.number}:L${row8.number}`); // 연락처 타이틀 (2칸)
      worksheet.mergeCells(`M${row8.number}:N${row8.number}`); // 연락처 값 (2칸 병합으로 연락처 짤림 박멸!)
      worksheet.mergeCells(`P${row8.number}:R${row8.number}`); // 이메일 값 (3칸 병합으로 긴 이메일 주소 짤림 박멸!)
      // O8은 이메일 타이틀 (1칸)

      // 행 높이 지정
      for (let i = startRow; i <= endRow; i++) {
        worksheet.getRow(i).height = 20;
      }
      worksheet.getRow(row7.number).height = 24; 

      // 5. 대표자 직인 도장 이미지 가져오기 및 성명 셀 우측 전용 칸(R4) 오버레이 삽입
      try {
        const stampBuffer = await loadImage('/stamp.png');
        const stampId = workbook.addImage({
          buffer: stampBuffer,
          extension: 'png'
        });
        // R4 (18번째 열, 0-based index 17) 빈 칸 정중앙에 직인을 투영하여 이름을 절대 가리지 않음!
        worksheet.addImage(stampId, {
          tl: { col: 17.05, row: row4.number - 1 + 0.1 }, 
          ext: { width: 32, height: 32 }
        });
      } catch (err) {
        console.warn('Excel Stamp Image Loading Bypass:', err);
      }

      // 공통 셀 테두리 및 서식 디자인 정의
      const thinBorder = {
        top: { style: 'thin' as const, color: { argb: 'CCCCCC' } },
        left: { style: 'thin' as const, color: { argb: 'CCCCCC' } },
        bottom: { style: 'thin' as const, color: { argb: 'CCCCCC' } },
        right: { style: 'thin' as const, color: { argb: 'CCCCCC' } }
      };

      for (let r = startRow; r <= endRow; r++) {
        for (let c = 1; c <= 18; c++) {
          const cell = worksheet.getCell(r, c);
          cell.border = thinBorder;
          cell.font = { name: '맑은 고딕', size: 9 };
          
          // 기본값: 정갈한 가운데 정렬 적용
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          
          // 긴 값 셀만 왼쪽 정렬 오버라이드
          const isLeftAlign = 
            (c >= 5 && c <= 9 && r !== row6.number) || // 수신 귀하 값, 견적일자 값, 유효기간 값
            (c >= 13 && c <= 18 && r === row5.number) || // 사업장주소 값 (6칸)
            (c >= 16 && c <= 18 && r === row8.number);   // 이메일 값 (3칸)

          if (isLeftAlign) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
          
          // 헤더 및 회색 타이틀 영역 처리 (18열 그리드 정합성 보완)
          const isGray = 
            (c >= 1 && c <= 4 && r !== row6.number && r !== row7.number && r !== row8.number) || // 수신, 견적일자, 유효기간 타이틀
            (c === 10) || // 공급자 세로 셀
            (c >= 11 && c <= 12 && r === row3.number) || // 등록번호 타이틀
            (c >= 11 && c <= 12 && r === row5.number) || // 사업장주소 타이틀
            (c >= 11 && c <= 12 && r === row4.number) || // 상호(명칭) 타이틀
            (c === 16 && r === row4.number) || // 성 명 타이틀
            (c >= 11 && c <= 12 && r === row6.number) || // 업 태 타이틀
            (c === 15 && r === row6.number) || // 종 목 타이틀
            (c >= 11 && c <= 12 && r === row7.number) || // 담당자 타이틀
            (c >= 11 && c <= 12 && r === row8.number) || // 연락처 타이틀
            (c === 15 && r === row8.number) || // 이메일 타이틀
            (c >= 1 && c <= 2 && (r === row7.number || r === row8.number)); // 합계금액/VAT포함 타이틀

          if (isGray) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'F2F2F2' }
            };
            cell.font = { name: '맑은 고딕', size: 9, bold: true };
          }
        }
      }

      // 특정 셀 정렬 미세 보정
      worksheet.getCell(`J${startRow}`).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      worksheet.getCell(`A${row6.number}`).alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getCell(`A${row7.number}`).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      worksheet.getCell(`C${row7.number}`).alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getCell(`C${row7.number}`).font = { name: '맑은 고딕', size: 12, bold: true };

      // 상하단 굵은 검정 테두리 마감선
      for (let c = 1; c <= 18; c++) {
        const topCell = worksheet.getCell(startRow, c);
        topCell.border = { ...topCell.border, top: { style: 'medium' as const, color: { argb: '000000' } } };
        const bottomCell = worksheet.getCell(endRow, c);
        bottomCell.border = { ...bottomCell.border, bottom: { style: 'medium' as const, color: { argb: '000000' } } };
      }

      // 9행: 빈행
      const spaceRow2 = worksheet.addRow([]);
      spaceRow2.height = 15;

      // 10행: 품목 목록 헤더 (18칸 분할 정렬)
      const headerRow = worksheet.addRow(['NO', '', '분류', '', '품목명 / 규격', '', '', '', '', '', '', '', '수량', '단가', '', '공급가액', '', '']);
      headerRow.height = 24;
      const hRowIdx = headerRow.number;
      
      worksheet.mergeCells(`A${hRowIdx}:B${hRowIdx}`); // NO (2칸)
      worksheet.mergeCells(`C${hRowIdx}:D${hRowIdx}`); // 분류 (2칸)
      worksheet.mergeCells(`E${hRowIdx}:L${hRowIdx}`); // 품목명 / 규격 (8칸!)
      // M10은 수량 (1칸)
      worksheet.mergeCells(`N${hRowIdx}:O${hRowIdx}`); // 단가 (2칸)
      worksheet.mergeCells(`P${hRowIdx}:R${hRowIdx}`); // 공급가액 (3칸!)

      for (let c = 1; c <= 18; c++) {
        const cell = worksheet.getCell(hRowIdx, c);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'E6E6E6' }
        };
        cell.font = { name: '맑은 고딕', size: 9, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = thinBorder;
      }

      // 11행 ~ : 품목 리스트 작성 (18칸 그리드 대응)
      items.forEach((item, index) => {
        const row = worksheet.addRow([
          index + 1, '',
          item.category || '', '',
          item.name || '', '', '', '', '', '', '', '',
          item.quantity,
          item.finalPrice, '',
          item.finalPrice * item.quantity, '', ''
        ]);
        row.height = 20;
        const curRowIdx = row.number;

        worksheet.mergeCells(`A${curRowIdx}:B${curRowIdx}`); // NO (2칸)
        worksheet.mergeCells(`C${curRowIdx}:D${curRowIdx}`); // 분류 (2칸)
        worksheet.mergeCells(`E${curRowIdx}:L${curRowIdx}`); // 품목명 (8칸)
        // M열 수량
        worksheet.mergeCells(`N${curRowIdx}:O${curRowIdx}`); // 단가 (2칸)
        worksheet.mergeCells(`P${curRowIdx}:R${curRowIdx}`); // 공급가액 (3칸)

        for (let c = 1; c <= 18; c++) {
          const cell = worksheet.getCell(curRowIdx, c);
          cell.border = thinBorder;
          cell.font = { name: '맑은 고딕', size: 9 };
          
          if (c === 1 || c === 3) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (c === 5) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          } else if (c === 13) {
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (c === 14 || c === 16) {
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          }
        }
      });

      // 패딩 빈 줄 추가 (총 10개 행 확보, 18칸 그리드)
      const paddingLength = Math.max(0, 10 - items.length);
      for (let i = 0; i < paddingLength; i++) {
        const row = worksheet.addRow(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        row.height = 20;
        const curRowIdx = row.number;

        worksheet.mergeCells(`A${curRowIdx}:B${curRowIdx}`);
        worksheet.mergeCells(`C${curRowIdx}:D${curRowIdx}`);
        worksheet.mergeCells(`E${curRowIdx}:L${curRowIdx}`);
        worksheet.mergeCells(`N${curRowIdx}:O${curRowIdx}`);
        worksheet.mergeCells(`P${curRowIdx}:R${curRowIdx}`);

        for (let c = 1; c <= 18; c++) {
          const cell = worksheet.getCell(curRowIdx, c);
          cell.border = thinBorder;
        }
      }

      // 총 합계 행 생성 및 이식 (18칸 대응)
      const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
      const totalRow = worksheet.addRow([
        '총 합계', '', '', '', '', '', '', '', '', '', '', '',
        totalQty,
        totalFinal, '',
        totalFinal, '', ''
      ]);
      totalRow.height = 22;
      const totalRowIdx = totalRow.number;

      worksheet.mergeCells(`A${totalRowIdx}:L${totalRowIdx}`); // 합계 텍스트 병합 (12칸)
      worksheet.mergeCells(`N${totalRowIdx}:O${totalRowIdx}`); // 단가 영역 병합
      worksheet.mergeCells(`P${totalRowIdx}:R${totalRowIdx}`); // 최종 합계 금액 (3칸)

      for (let c = 1; c <= 18; c++) {
        const cell = worksheet.getCell(totalRowIdx, c);
        cell.border = thinBorder;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F9F9F9' }
        };
        cell.font = { name: '맑은 고딕', size: 9, bold: true };

        if (c === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (c === 12) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (c === 15) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      }

      // 품목 테이블 상하단 굵은 검정 테두리 마감선 (18열 전 영역 마감)
      for (let c = 1; c <= 18; c++) {
        const headerTopCell = worksheet.getCell(hRowIdx, c);
        headerTopCell.border = { ...headerTopCell.border, top: { style: 'medium' as const, color: { argb: '000000' } } };
        const footerBottomCell = worksheet.getCell(totalRowIdx, c);
        footerBottomCell.border = { ...footerBottomCell.border, bottom: { style: 'medium' as const, color: { argb: '000000' } } };
      }

      // 안내 문구 추가
      worksheet.addRow([]); // 빈줄
      worksheet.addRow(['* 부품 수급 상황에 따라 동급의 타사 제품으로 대체될 수 있습니다.']);
      worksheet.mergeCells(`A${totalRowIdx + 2}:R${totalRowIdx + 2}`);
      worksheet.getCell(`A${totalRowIdx + 2}`).font = { name: '맑은 고딕', size: 8, color: { argb: '666666' } };

      worksheet.addRow([]); // 빈줄
      worksheet.addRow(['* 가격정보가 수시로 변경 되므로 구매시 최종 단가를 반드시 다시 확인하시기 바랍니다.']);
      worksheet.mergeCells(`A${totalRowIdx + 4}:R${totalRowIdx + 4}`);
      worksheet.getCell(`A${totalRowIdx + 4}`).font = { name: '맑은 고딕', size: 8, color: { argb: '666666' } };

      // 10. 진짜 .xlsx 바이너리 버퍼 생성 및 브라우저 다운로드 연계
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('ExcelJS generation failed:', error);
      alert('엑셀 파일 생성에 실패했습니다.');
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      alert('템플릿 이름을 입력해주세요.');
      return;
    }
    try {
      const { error } = await supabase.from('quote_templates').insert([{
        template_name: newTemplateName,
        customer_name: customerName,
        global_margin: globalMargin,
        items: items,
        total_final: items.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0)
      }]);
      if (error) throw error;
      alert('견적 템플릿이 저장되었습니다.');
      setSaveDialogOpen(false);
      setNewTemplateName('');
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('quote_templates')
      .select('id, template_name, customer_name, total_final, created_at, items')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setTemplates(data);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('정말로 삭제 하시겠습니까?')) {
      return;
    }
    try {
      const { error } = await supabase.from('quote_templates').delete().eq('id', templateId);
      if (error) throw error;
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleOpenLoadDialog = () => {
    fetchTemplates();
    setLoadDialogOpen(true);
  };

  const handleLoadTemplate = async (templateId: string) => {
    if (!window.confirm('현재 작성 중인 내용이 지워집니다. 진행할까요?')) {
      return;
    }
    const { data, error } = await supabase
      .from('quote_templates')
      .select('*')
      .eq('id', templateId)
      .single();
      
    if (!error && data) {
      setCustomerName(data.customer_name || '');
      setGlobalMargin(data.global_margin || 15);
      setItems(data.items || []);
      setLoadDialogOpen(false);
    } else {
      alert('템플릿을 불러오는데 실패했습니다.');
    }
  };

  const totalCost = items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
  const totalFinal = items.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
  const totalMargin = totalFinal - totalCost;

  return (
    <Container maxWidth="lg">
      <Helmet><title>간편견적 | COMTOOIN</title></Helmet>

      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: { xs: 1.5, sm: 2, md: 2.5 } }}>
        <Stack direction="row" alignItems="center" spacing={{ xs: 1, sm: 1.25, md: 1.5 }} mb={{ xs: 0.25, sm: 0.5, md: 1 }}>
          <ReceiptIcon sx={{ fontSize: { xs: '1.6rem', sm: '1.9rem', md: '2.2rem' }, color: 'primary.main' }} />
          <Typography component="h1" sx={{ fontWeight: 'bold', fontSize: { xs: '1.2rem', sm: '1.35rem', md: '1.5rem' } }}>
            간편견적
          </Typography>
        </Stack>
        <Typography sx={{ color: 'text.secondary', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' }, lineHeight: 1.4 }}>
          부품 견적 데이터를 작성하고 마진율을 조율하여 PDF 견적서를 발행합니다.
        </Typography>
      </Box>

      <Divider sx={{ mb: { xs: 1.5, sm: 2, md: 2.5 } }} />

      <Box>
        <Grid container spacing={3}>
          <Grid item xs={12}>
          {/* 상단 통합 컨트롤 바 (모바일 및 PC 반응형 최적화) */}
          <Paper 
            variant="outlined" 
            sx={{ 
              p: { xs: 1.2, sm: 1.5 }, 
              mb: 3, 
              borderRadius: 1, 
              bgcolor: 'background.paper',
              display: 'flex', 
              flexDirection: { xs: 'column', md: 'row' }, 
              gap: { xs: 2, md: 3 }, 
              alignItems: { xs: 'stretch', md: 'center' } 
            }}
          >
            {/* 기본 설정 */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { xs: 'stretch', sm: 'center' }, flexGrow: 1 }}>
              <TextField
                label="거래처명 (공급받는 자)"
                size="small"
                fullWidth
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                sx={{ flexGrow: 1 }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  label="일괄 마진율"
                  type="number"
                  size="small"
                  fullWidth
                  value={globalMargin}
                  onChange={(e) => setGlobalMargin(Number(e.target.value))}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  sx={{ minWidth: '100px' }}
                />
                <Button variant="outlined" color="primary" onClick={handleGlobalMarginApply} sx={{ whiteSpace: 'nowrap', height: '36px', fontSize: '0.75rem', borderRadius: 1, fontWeight: 'bold' }}>
                  적용
                </Button>
              </Box>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

            {/* 액션 버튼들 */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, flexWrap: 'wrap' }}>
              <Button 
                variant="contained" 
                color="primary" 
                startIcon={<AutoFixHighIcon />}
                onClick={() => setPasteDialogOpen(true)}
                sx={{ fontWeight: 'bold', width: { xs: '100%', sm: '220px' }, height: '36px', fontSize: '0.75rem', borderRadius: 1, whiteSpace: 'nowrap' }}
              >
                텍스트 견적 자동입력
              </Button>
              <Button 
                variant="outlined" 
                color="secondary" 
                startIcon={<FolderOpenIcon />}
                onClick={handleOpenLoadDialog}
                sx={{ fontWeight: 'bold', width: { xs: '100%', sm: '220px' }, height: '36px', fontSize: '0.75rem', borderRadius: 1, whiteSpace: 'nowrap' }}
              >
                저장된 견적 템플릿
              </Button>
            </Box>
          </Paper>

          {/* 하단 견적 상세 내역 테이블 */}
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 1, bgcolor: 'background.paper' }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" fontWeight="bold">
                견적 상세 내역
              </Typography>
            </Box>

              <TableContainer sx={{ maxHeight: { xs: 500, sm: 400 }, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <Table size="small" stickyHeader sx={{ minWidth: 750 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell align="center" width="40" sx={{ whiteSpace: 'nowrap' }}>NO</TableCell>
                      <TableCell align="center" width="90" sx={{ whiteSpace: 'nowrap' }}>분류</TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>품목명</TableCell>
                      <TableCell align="center" width="75" sx={{ whiteSpace: 'nowrap' }}>수량</TableCell>
                      <TableCell align="center" width="100" sx={{ whiteSpace: 'nowrap' }}>원단가</TableCell>
                      <TableCell align="center" width="80" sx={{ whiteSpace: 'nowrap' }}>마진(%)</TableCell>
                      <TableCell align="center" width="100" sx={{ whiteSpace: 'nowrap' }}>견적단가</TableCell>
                      <TableCell align="center" width="110" sx={{ whiteSpace: 'nowrap' }}>합계</TableCell>
                      <TableCell align="center" width="50" sx={{ whiteSpace: 'nowrap' }}>삭제</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell align="center">{index + 1}</TableCell>
                        <TableCell align="left">
                          <TextField
                            variant="standard"
                            value={item.category}
                            onChange={(e) => handleItemFieldChange(item.id, 'category', e.target.value)}
                            sx={{ width: 65, '& .MuiInput-root:before': { borderBottom: '1px dashed #ccc' } }}
                            InputProps={{ style: { fontSize: '0.85rem' } }}
                            inputProps={{ style: { padding: '4px' } }}
                          />
                        </TableCell>
                        <TableCell align="left">
                          <TextField
                            variant="standard"
                            value={item.name}
                            onChange={(e) => handleItemFieldChange(item.id, 'name', e.target.value)}
                            fullWidth
                            sx={{ '& .MuiInput-root:before': { borderBottom: '1px dashed #ccc' } }}
                            InputProps={{ style: { fontSize: '0.85rem' } }}
                            inputProps={{ style: { padding: '4px' } }}
                          />
                        </TableCell>
                        <TableCell align="left">
                          <TextField
                            variant="standard"
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemQuantityChange(item.id, Number(e.target.value))}
                            sx={{ 
                              width: 55, 
                              '& .MuiInput-root:before': { borderBottom: '1px dashed #ccc' }
                            }}
                            InputProps={{ style: { fontSize: '0.85rem' } }}
                            inputProps={{ style: { padding: '4px' }, min: 1 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            variant="standard"
                            type="number"
                            value={item.costPrice === 0 ? '' : item.costPrice}
                            onChange={(e) => handleItemCostPriceChange(item.id, Number(e.target.value))}
                            sx={{ 
                              width: 80, 
                              ml: 'auto',
                              display: 'flex',
                              '& .MuiInput-root:before': { borderBottom: '1px dashed #ccc' },
                              '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                              '& input[type=number]': { MozAppearance: 'textfield' }
                            }}
                            InputProps={{ style: { fontSize: '0.85rem', textAlign: 'right' } }}
                            inputProps={{ style: { textAlign: 'right', padding: '4px' } }}
                          />
                        </TableCell>
                        <TableCell align="left">
                          <TextField
                            variant="standard"
                            type="number"
                            value={item.marginRate}
                            onChange={(e) => handleItemMarginChange(item.id, Number(e.target.value))}
                            sx={{ 
                              width: 60, 
                              '& .MuiInput-root:before': { borderBottom: '1px dashed #ccc' }
                            }}
                            InputProps={{ style: { fontSize: '0.85rem' } }}
                            inputProps={{ style: { padding: '4px' } }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{item.finalPrice.toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'primary.main' }}>{(item.finalPrice * item.quantity).toLocaleString()}</TableCell>
                        <TableCell align="center" padding="none">
                          <IconButton size="small" color="error" onClick={() => handleItemRemove(item.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 1.5, mb: 1, display: 'flex', gap: 1.5, justifyContent: 'flex-start' }}>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddItemManually}
                  sx={{ height: '36px', fontSize: '0.75rem', borderRadius: 1, fontWeight: 'bold' }}
                >
                  항목 직접 추가
                </Button>
                <Button 
                  variant="outlined" 
                  color="error" 
                  size="small"
                  startIcon={<DeleteIcon />}
                  onClick={() => {
                    if(window.confirm('입력된 모든 내역을 지우시겠습니까?')) {
                      setItems([]);
                      setCustomerName('');
                      setGlobalMargin(15);
                    }
                  }}
                  disabled={items.length === 0}
                  sx={{ height: '36px', fontSize: '0.75rem', borderRadius: 1, fontWeight: 'bold' }}
                >
                  초기화
                </Button>
              </Box>

              <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="body2" display="flex" justifyContent="space-between">
                  <span>총 원가:</span> <strong>{totalCost.toLocaleString()} 원</strong>
                </Typography>
                <Typography variant="body2" display="flex" justifyContent="space-between" color="primary.main">
                  <span>예상 마진:</span> <strong>{totalMargin.toLocaleString()} 원</strong>
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" display="flex" justifyContent="space-between" fontWeight="bold">
                  <span>최종 견적가:</span> <span>{totalFinal.toLocaleString()} 원</span>
                </Typography>
              </Box>
              <Box sx={{ mt: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
                <Button 
                  variant="outlined" 
                  color="primary" 
                  startIcon={<SaveIcon />}
                  onClick={() => setNewTemplateName(`${customerName || '고객'} 견적_${format(new Date(), 'yyyyMMdd')}`)}
                  sx={{ width: { xs: '100%', sm: '220px' }, height: '36px', fontSize: '0.75rem', borderRadius: 1, fontWeight: 'bold', whiteSpace: 'nowrap' }}
                >
                  견적 템플릿 저장
                </Button>
                <Button 
                  variant="contained" 
                  color="secondary" 
                  onClick={() => setPreviewOpen(true)}
                  sx={{ width: { xs: '100%', sm: '220px' }, height: '36px', fontSize: '0.75rem', borderRadius: 1, fontWeight: 'bold', whiteSpace: 'nowrap' }}
                >
                  미리보기 및 다운로드
                </Button>
              </Box>
          </Paper>
        </Grid>
       </Grid>
      </Box>

      {/* 텍스트 견적 자동입력 모달 */}
      <Dialog 
        open={pasteDialogOpen} 
        onClose={(event, reason) => {
          if (reason !== 'backdropClick') {
            setPasteDialogOpen(false);
          }
        }} 
        disableEscapeKeyDown
        maxWidth="sm" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '20px 16px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 40px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 32px)' },
            maxWidth: { xs: 'calc(100% - 32px)', sm: 'sm' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>텍스트 견적 자동입력</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ lineHeight: 1.5 }}>
            쇼핑몰 견적서 페이지의 품목 목록을 전체 복사(Ctrl+A ➔ Ctrl+C)하여 아래에 붙여넣으세요.<br />
            줄별로 <strong>[분류, 품목명, 수량, 금액]</strong>을 감지하여 표에 자동으로 입력합니다.
          </Typography>
          <TextField
            multiline
            rows={10}
            fullWidth
            variant="outlined"
            placeholder={`[입력 예시 1: 컴퓨존/조이젠 등 견적서 복사 양식]
CPU	[AMD] 라이젠5 5600 (멀티팩)	152,000원	1	152,000원
메모리	[삼성전자] DDR4 8GB	26,500원	2	53,000원
SSD	[삼성전자] 980 M.2 NVMe (500GB)	79,000원	1	79,000원

[입력 예시 2: 공백/줄바꿈 형태의 자유 양식]
CPU [AMD] 라이젠5 7500F 210,000 원 1 210,000 원
메모리 삼성전자 DDR5 16G 65,000 원 2 130,000 원`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            sx={{ mt: 2, fontFamily: 'monospace', fontSize: '0.85rem' }}
          />
        </DialogContent>
        <DialogActions sx={{ p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'row', gap: 1, '& button': { flex: { xs: 1, sm: 'initial' }, width: { sm: 'auto' }, m: '0 !important' } }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleParse}
            startIcon={<AutoFixHighIcon />}
            sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1 }}
          >
            자동입력
          </Button>
          <Button onClick={() => setPasteDialogOpen(false)} variant="outlined" color="inherit" sx={{ height: '36px', fontSize: '0.75rem', borderRadius: 1 }}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={(event, reason) => {
          if (reason !== 'backdropClick') {
            setPreviewOpen(false);
          }
        }} 
        disableEscapeKeyDown
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
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          견적서 인쇄 미리보기
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#e0e0e0', display: 'flex', justifyContent: { xs: 'flex-start', md: 'center' }, p: { xs: 1, sm: 3 }, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {/* A4 Paper Dimensions: 210 x 297 mm -> approx 794 x 1123 px at 96 DPI */}
          <Box 
              ref={printRef}
              sx={{ 
                width: '794px', 
                minHeight: '1123px', 
                bgcolor: 'white', 
                boxShadow: 3,
                p: 4,
                boxSizing: 'border-box',
                flexShrink: 0
              }}
            >
              {/* Header */}
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2.5, position: 'relative', minHeight: 60 }}>
                <Box component="img" src="/comtooin_logo.jpg" alt="logo" sx={{ position: 'absolute', left: 0, height: 50 }} />
                <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: 10, mr: -1 }}>
                  견 적 서
                </Typography>
              </Box>
              
              {/* 고객 및 공급자 정보 (완벽한 좌우 대칭 테이블 구조) */}
              <Table size="small" sx={{ mb: 2, borderTop: '2px solid black', borderBottom: '2px solid black', '& .MuiTableCell-root': { border: '1px solid #ddd', py: 0.5, px: 1, whiteSpace: 'nowrap', fontSize: '0.85rem' } }}>
                <TableBody>
                  {/* 1행 */}
                  <TableRow>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', width: '12%', textAlign: 'center' }}>수 신</TableCell>
                    <TableCell sx={{ width: '35%', fontWeight: '900', fontSize: '1rem' }}>{customerName || '____________________'} 귀하</TableCell>
                    
                    <TableCell rowSpan={6} width="30px" sx={{ bgcolor: '#f5f5f5', writingMode: 'vertical-rl', textOrientation: 'upright', textAlign: 'center', fontWeight: 'bold', letterSpacing: 4, p: 0, borderBottom: '2px solid black' }}>
                      공급자
                    </TableCell>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', width: '12%', textAlign: 'center' }}>등록번호</TableCell>
                    <TableCell colSpan={3} sx={{ letterSpacing: 1 }}>108-17-56709</TableCell>
                  </TableRow>
                  
                  {/* 2행 */}
                  <TableRow>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>견적일자</TableCell>
                    <TableCell>{format(new Date(), 'yyyy년 MM월 dd일')}</TableCell>
                    
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>상호(명칭)</TableCell>
                    <TableCell sx={{ fontSize: '0.95rem' }}>
                      컴투인
                    </TableCell>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', width: '10%', textAlign: 'center' }}>성 명</TableCell>
                    <TableCell sx={{ width: '12%', position: 'relative' }}>
                      김종범
                      <Box component="img" src="/stamp.png" alt="stamp" sx={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', width: 45, height: 45, objectFit: 'contain', zIndex: 1 }} />
                    </TableCell>
                  </TableRow>

                  {/* 3행 */}
                  <TableRow>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>유효기간</TableCell>
                    <TableCell>견적일로부터 7일</TableCell>
                    
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>사업장주소</TableCell>
                    <TableCell colSpan={3}>경기도 의정부시 신촌로63번길42 501호</TableCell>
                  </TableRow>

                  {/* 4행 */}
                  <TableRow>
                    <TableCell colSpan={2} sx={{ textAlign: 'center', py: 1.5, fontWeight: 'bold' }}>
                      아래와 같이 견적합니다.
                    </TableCell>
                    
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>업 태</TableCell>
                    <TableCell>도소매</TableCell>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>종 목</TableCell>
                    <TableCell>컴퓨터 및 주변기기</TableCell>
                  </TableRow>

                  {/* 5행 */}
                  <TableRow>
                    <TableCell component="th" rowSpan={2} sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center', fontSize: '0.9rem', borderBottom: '2px solid black' }}>합계금액<br/>(VAT포함)</TableCell>
                    <TableCell rowSpan={2} sx={{ fontWeight: 'bold', fontSize: '1.25rem !important', textAlign: 'left', pl: 3, borderBottom: '2px solid black', whiteSpace: 'nowrap' }}>
                      {Math.round(totalFinal * 1.1).toLocaleString()} 원
                    </TableCell>
                    
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>담당자</TableCell>
                    <TableCell>{currentUser?.name || '관리자'}</TableCell>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>연락처</TableCell>
                    <TableCell sx={{ '& a': { textDecoration: 'none !important', color: 'inherit !important' } }}>{currentUser?.phone || '-'}</TableCell>
                  </TableRow>

                  {/* 6행 */}
                  <TableRow>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center', borderBottom: '2px solid black' }}>이메일</TableCell>
                    <TableCell colSpan={3} sx={{ borderBottom: '2px solid black', '& a': { textDecoration: 'none !important', color: 'inherit !important' } }}>{currentUser?.email || '-'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {/* Items Table */}
              <Table size="small" sx={{ borderTop: '2px solid black', borderBottom: '2px solid black', '& .MuiTableCell-root': { border: '1px solid #ddd', py: 0.6 } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f0f0f0' }}>
                    <TableCell align="center" width="50px" sx={{ whiteSpace: 'nowrap' }}>NO</TableCell>
                    <TableCell align="center" width="90px" sx={{ whiteSpace: 'nowrap' }}>분류</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>품목명 / 규격</TableCell>
                    <TableCell align="center" width="45px" sx={{ whiteSpace: 'nowrap' }}>수량</TableCell>
                    <TableCell align="center" width="115px" sx={{ whiteSpace: 'nowrap' }}>단가</TableCell>
                    <TableCell align="center" width="135px" sx={{ whiteSpace: 'nowrap' }}>공급가액</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{index + 1}</TableCell>
                      <TableCell align="left" sx={{ whiteSpace: 'nowrap', pl: 1 }}>{item.category}</TableCell>
                      <TableCell align="left" sx={{ fontSize: '0.85rem', pl: 1 }}>{item.name}</TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{item.quantity}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{item.finalPrice.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{(item.finalPrice * item.quantity).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {/* Empty rows filler if items are few */}
                  {Array.from({ length: Math.max(0, 10 - items.length) }).map((_, i) => (
                    <TableRow key={`empty-${i}`}>
                      <TableCell>&nbsp;</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                  {/* Total Footer inside Table */}
                  <TableRow sx={{ bgcolor: '#f9f9f9' }}>
                    <TableCell colSpan={3} align="center" sx={{ fontWeight: 'bold' }}>총 합계</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                      {items.reduce((sum, item) => sum + item.quantity, 0)}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                      {totalFinal.toLocaleString()} 원
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              
              <Typography variant="caption" sx={{ mt: 2, color: '#666', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <span>* 부품 수급 상황에 따라 동급의 타사 제품으로 대체될 수 있습니다.</span>
                <span>* 가격정보가 수시로 변경 되므로 구매시 최종 단가를 반드시 다시 확인하시기 바랍니다.</span>
              </Typography>
            </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, display: 'flex', flexDirection: 'row', gap: 1, '& button': { flex: { xs: 1, sm: 'initial' }, width: { sm: 'auto' }, m: '0 !important' } }}>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<DownloadIcon />}
            onClick={() => { handleDownloadPDF(); setPreviewOpen(false); }}
            disabled={items.length === 0}
            sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1 }}
          >
            PDF 다운로드
          </Button>
          <Button 
            variant="contained" 
            color="success" 
            startIcon={<DownloadIcon />}
            onClick={() => { handleDownloadExcel(); setPreviewOpen(false); }}
            disabled={items.length === 0}
            sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1, bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
          >
            엑셀 다운로드
          </Button>
          <Button onClick={() => setPreviewOpen(false)} variant="outlined" color="inherit" sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1 }}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog 
        open={!!newTemplateName || saveDialogOpen} 
        onClose={(event, reason) => {
          if (reason !== 'backdropClick') {
            setNewTemplateName(''); 
            setSaveDialogOpen(false);
          }
        }} 
        disableEscapeKeyDown
        maxWidth="xs" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '20px 16px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 40px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 32px)', sm: '480px' },
            maxWidth: { xs: 'calc(100% - 32px)', sm: '480px' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>견적 템플릿 저장</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus
            fullWidth
            label="템플릿 이름"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="예: 사무용 PC (기본형)"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, display: 'flex', flexDirection: 'row', gap: 1, '& button': { flex: { xs: 1, sm: 'initial' }, width: { sm: 'auto' }, m: '0 !important' } }}>
          <Button onClick={handleSaveTemplate} variant="contained" color="primary" sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1 }}>저장</Button>
          <Button onClick={() => { setNewTemplateName(''); setSaveDialogOpen(false); }} variant="outlined" color="inherit" sx={{ height: '36px', fontSize: '0.75rem', borderRadius: 1 }}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* Load Template Dialog */}
      <Dialog 
        open={loadDialogOpen} 
        onClose={(event, reason) => {
          if (reason !== 'backdropClick') {
            setLoadDialogOpen(false);
          }
        }} 
        disableEscapeKeyDown
        maxWidth="sm" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '12px 8px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 16px)' },
            maxWidth: { xs: 'calc(100% - 16px)', sm: 'sm' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>저장된 견적 템플릿</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {templates.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              저장된 견적 템플릿이 없습니다.
            </Box>
          ) : (
            <List sx={{ pt: 0 }}>
              {templates.map((tpl) => (
                <ListItem key={tpl.id} disablePadding divider sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <ListItemButton onClick={() => setExpandedTemplateId(expandedTemplateId === tpl.id ? null : tpl.id)}>
                    <ListItemText 
                      primary={<Typography fontWeight="bold">{tpl.template_name}</Typography>}
                      secondary={
                        <React.Fragment>
                          <Typography variant="body2" component="span" sx={{ color: 'primary.main', mr: 2 }}>
                            {tpl.customer_name || '거래처 미지정'}
                          </Typography>
                          총 {tpl.total_final?.toLocaleString()} 원 
                          <span style={{ float: 'right', fontSize: '0.8rem', color: '#999' }}>
                            {format(new Date(tpl.created_at), 'yyyy-MM-dd HH:mm')}
                          </span>
                        </React.Fragment>
                      }
                    />
                  </ListItemButton>
                  <Collapse in={expandedTemplateId === tpl.id} timeout="auto" unmountOnExit>
                    <Box sx={{ p: 2, bgcolor: '#f9f9f9', borderTop: '1px dashed #ccc' }}>
                      <Typography variant="caption" fontWeight="bold" color="text.secondary" gutterBottom display="block">
                        상세 품목 내역
                      </Typography>
                      <List dense disablePadding>
                        {tpl.items?.map((item: any, idx: number) => (
                          <ListItem key={idx} disablePadding sx={{ py: 0.5 }}>
                            <Typography variant="body2" sx={{ flexGrow: 1, fontSize: '0.85rem' }}>
                              - {item.name}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#666', minWidth: '40px', textAlign: 'right' }}>
                              {item.quantity}개
                            </Typography>
                          </ListItem>
                        ))}
                      </List>
                      <Box sx={{ mt: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, justifyContent: 'space-between', alignItems: 'stretch' }}>
                        <Button 
                          variant="text" 
                          size="small" 
                          color="error" 
                          startIcon={<DeleteIcon />}
                          onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }}
                          sx={{ height: '36px', fontSize: '0.75rem', borderRadius: 1, justifyContent: { xs: 'center', sm: 'flex-start' } }}
                        >
                          삭제
                        </Button>
                        <Button 
                          variant="contained" 
                          size="small" 
                          color="primary" 
                          onClick={(e) => { e.stopPropagation(); handleLoadTemplate(tpl.id); }}
                          sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1 }}
                        >
                          이 템플릿 불러오기
                        </Button>
                      </Box>
                    </Box>
                  </Collapse>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1, '& button': { width: { xs: '100%', sm: 'auto' }, m: '0 !important' } }}>
          <Button onClick={() => setLoadDialogOpen(false)} variant="outlined" color="inherit" sx={{ fontWeight: 'bold', height: '36px', fontSize: '0.75rem', borderRadius: 1 }}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminQuotePage;