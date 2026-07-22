using System;
using System.IO;
using System.Net;
using System.Text;
using System.Management;
using System.Windows.Forms;
using System.Drawing;
using System.Collections.Generic;
using Microsoft.Win32;

namespace ComtooinScanner
{
    public class Program
    {
        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            
            string url, key, custId, custName;
            if (!LoadConfig(out url, out key, out custId, out custName))
            {
                MessageBox.Show("설정 정보를 찾을 수 없거나 올바르지 않습니다. 웹사이트에서 프로그램을 다시 다운로드해 주세요.", "오류", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            Application.Run(new ScannerForm(url, key, custId, custName));
        }

        private static bool LoadConfig(out string supabaseUrl, out string supabaseKey, out string customerId, out string customerName)
        {
            supabaseUrl = "";
            supabaseKey = "";
            customerId = "";
            customerName = "";

            try
            {
                string exePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
                byte[] fileBytes;
                using (FileStream fs = new FileStream(exePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                {
                    fileBytes = new byte[fs.Length];
                    fs.Read(fileBytes, 0, fileBytes.Length);
                }

                string fileContent = Encoding.UTF8.GetString(fileBytes);
                int startIndex = fileContent.LastIndexOf("CT_CONFIG_START|");
                int endIndex = fileContent.LastIndexOf("|CT_CONFIG_END");

                if (startIndex != -1 && endIndex != -1 && startIndex < endIndex)
                {
                    string configData = fileContent.Substring(startIndex + "CT_CONFIG_START|".Length, endIndex - startIndex - "CT_CONFIG_START|".Length);
                    string[] parts = configData.Split('|');
                    if (parts.Length >= 4)
                    {
                        supabaseUrl = parts[0].Trim();
                        supabaseKey = parts[1].Trim();
                        customerId = parts[2].Trim();
                        customerName = parts[3].Trim();
                        return true;
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("설정 로드 중 오류가 발생했습니다: " + ex.Message, "오류", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            return false;
        }
    }

    public class ScannerForm : Form
    {
        private static readonly string LOGO_BASE64 = "LOGO_BASE64_PLACEHOLDER";

        private static Image GetLogoImage()
        {
            try
            {
                byte[] imageBytes = Convert.FromBase64String(LOGO_BASE64);
                using (System.IO.MemoryStream ms = new System.IO.MemoryStream(imageBytes))
                {
                    return Image.FromStream(ms);
                }
            }
            catch { }
            return null;
        }

        private static Icon GetLogoIcon()
        {
            try
            {
                byte[] imageBytes = Convert.FromBase64String(LOGO_BASE64);
                using (System.IO.MemoryStream ms = new System.IO.MemoryStream(imageBytes))
                {
                    using (Bitmap bmp = new Bitmap(ms))
                    {
                        IntPtr hicon = bmp.GetHicon();
                        return Icon.FromHandle(hicon);
                    }
                }
            }
            catch { }
            return null;
        }

        private string supabaseUrl;
        private string supabaseKey;
        private string customerId;
        private string customerName;

        private TextBox txtDept;
        private TextBox txtName;
        private Label lblStatus;
        private Button btnScan;

        public ScannerForm(string url, string key, string custId, string custName)
        {
            this.supabaseUrl = url;
            this.supabaseKey = key;
            this.customerId = custId;
            this.customerName = custName;

            this.Text = "컴투인 (COMTOOIN) PC 자산 조사";
            this.Size = new Size(460, 480);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.White;
            this.Font = new Font("Malgun Gothic", 9F, FontStyle.Regular);

            try
            {
                Icon appIcon = GetLogoIcon();
                if (appIcon != null)
                {
                    this.Icon = appIcon;
                }
            }
            catch { }

            // Title Logo PictureBox
            PictureBox picLogo = new PictureBox();
            try
            {
                Image appLogo = GetLogoImage();
                if (appLogo != null)
                {
                    picLogo.Image = appLogo;
                }
            }
            catch { }
            picLogo.SizeMode = PictureBoxSizeMode.Zoom;
            picLogo.Location = new Point(20, 20);
            picLogo.Size = new Size(30, 30);
            this.Controls.Add(picLogo);

            // Title Label
            Label lblTitle = new Label();
            lblTitle.Text = "컴투인 PC 자산 조사";
            lblTitle.Font = new Font("Malgun Gothic", 15F, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(30, 58, 138); // #1e3a8a
            lblTitle.Location = new Point(56, 22);
            lblTitle.Size = new Size(360, 30);
            this.Controls.Add(lblTitle);

            // Description Label
            Label lblDesc = new Label();
            lblDesc.Text = "본 프로그램은 승인된 IT 자산 수집 도구입니다. PC 사양 및 설치 소프트웨어 목록을 분석하여 자산 관리 서버에 안전하게 등록합니다.";
            lblDesc.ForeColor = Color.FromArgb(100, 116, 139); // #64748b
            lblDesc.Location = new Point(20, 60);
            lblDesc.Size = new Size(400, 50);
            this.Controls.Add(lblDesc);

            // Customer Info Card Panel
            Panel pnlCard = new Panel();
            pnlCard.BackColor = Color.FromArgb(239, 246, 255); // #eff6ff
            pnlCard.Location = new Point(20, 120);
            pnlCard.Size = new Size(400, 45);
            pnlCard.BorderStyle = BorderStyle.FixedSingle;
            
            Label lblCustLabel = new Label();
            lblCustLabel.Text = "인증 대상 고객사";
            lblCustLabel.Font = new Font("Malgun Gothic", 9F, FontStyle.Bold);
            lblCustLabel.ForeColor = Color.FromArgb(30, 64, 175); // #1e40af
            lblCustLabel.Location = new Point(10, 12);
            lblCustLabel.Size = new Size(120, 20);
            pnlCard.Controls.Add(lblCustLabel);

            Label lblCustVal = new Label();
            lblCustVal.Text = this.customerName;
            lblCustVal.Font = new Font("Malgun Gothic", 10F, FontStyle.Bold);
            lblCustVal.ForeColor = Color.FromArgb(29, 78, 216); // #1d4ed8
            lblCustVal.Location = new Point(140, 12);
            lblCustVal.Size = new Size(250, 20);
            lblCustVal.TextAlign = ContentAlignment.TopRight;
            pnlCard.Controls.Add(lblCustVal);
            
            this.Controls.Add(pnlCard);

            // Department Input
            Label lblDept = new Label();
            lblDept.Text = "소속 부서";
            lblDept.Font = new Font("Malgun Gothic", 9F, FontStyle.Bold);
            lblDept.ForeColor = Color.FromArgb(71, 85, 105); // #475569
            lblDept.Location = new Point(20, 185);
            lblDept.Size = new Size(200, 18);
            this.Controls.Add(lblDept);

            txtDept = new TextBox();
            txtDept.Location = new Point(20, 205);
            txtDept.Size = new Size(400, 30);
            txtDept.Font = new Font("Malgun Gothic", 10F);
            this.Controls.Add(txtDept);

            // Username Input
            Label lblName = new Label();
            lblName.Text = "사용자 이름";
            lblName.Font = new Font("Malgun Gothic", 9F, FontStyle.Bold);
            lblName.ForeColor = Color.FromArgb(71, 85, 105); // #475569
            lblName.Location = new Point(20, 245);
            lblName.Size = new Size(200, 18);
            this.Controls.Add(lblName);

            txtName = new TextBox();
            txtName.Location = new Point(20, 265);
            txtName.Size = new Size(400, 30);
            txtName.Font = new Font("Malgun Gothic", 10F);
            this.Controls.Add(txtName);

            // Status Box Label
            lblStatus = new Label();
            lblStatus.Text = "대기 중... (부서와 이름을 입력 후 시작하세요)";
            lblStatus.BackColor = Color.FromArgb(241, 245, 249); // #f1f5f9
            lblStatus.ForeColor = Color.FromArgb(71, 85, 105); // #475569
            lblStatus.Font = new Font("Malgun Gothic", 9F, FontStyle.Bold);
            lblStatus.Location = new Point(20, 315);
            lblStatus.Size = new Size(400, 40);
            lblStatus.TextAlign = ContentAlignment.MiddleCenter;
            lblStatus.BorderStyle = BorderStyle.FixedSingle;
            this.Controls.Add(lblStatus);

            // Scan Button
            btnScan = new Button();
            btnScan.Text = "PC 자산 조사 및 등록 시작";
            btnScan.BackColor = Color.FromArgb(37, 99, 235); // #2563eb
            btnScan.ForeColor = Color.White;
            btnScan.Font = new Font("Malgun Gothic", 10F, FontStyle.Bold);
            btnScan.Location = new Point(20, 375);
            btnScan.Size = new Size(400, 44);
            btnScan.FlatStyle = FlatStyle.Flat;
            btnScan.FlatAppearance.BorderSize = 0;
            btnScan.Cursor = Cursors.Hand;
            btnScan.Click += new EventHandler(btnScan_Click);
            this.Controls.Add(btnScan);
        }

        private void btnScan_Click(object sender, EventArgs e)
        {
            string dept = txtDept.Text.Trim();
            string name = txtName.Text.Trim();

            if (string.IsNullOrEmpty(dept))
            {
                MessageBox.Show("소속 부서를 입력해 주세요.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                txtDept.Focus();
                return;
            }
            if (string.IsNullOrEmpty(name))
            {
                MessageBox.Show("사용자 이름을 입력해 주세요.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                txtName.Focus();
                return;
            }

            txtDept.Enabled = false;
            txtName.Enabled = false;
            btnScan.Enabled = false;
            lblStatus.Text = "PC 정보 분석 및 자산 서버 등록 중...";
            lblStatus.ForeColor = Color.FromArgb(217, 119, 6); // #d97706

            Timer timer = new Timer();
            timer.Interval = 100;
            timer.Tick += (s, ev) =>
            {
                timer.Stop();
                try
                {
                    DoScan(dept, name);
                }
                catch (Exception ex)
                {
                    lblStatus.Text = "조사 중 에러가 발생했습니다.";
                    lblStatus.ForeColor = Color.Red;
                    MessageBox.Show("오류 내용: " + ex.Message, "에러", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    txtDept.Enabled = true;
                    txtName.Enabled = true;
                    btnScan.Enabled = true;
                }
            };
            timer.Start();
        }

        private void DoScan(string dept, string name)
        {
            string osName = GetWmiValue("Win32_OperatingSystem", "Caption") + " (" + GetWmiValue("Win32_OperatingSystem", "OSArchitecture") + ")";
            string processor = GetWmiValue("Win32_Processor", "Name");
            string motherboard = GetWmiValue("Win32_BaseBoard", "Manufacturer") + " " + GetWmiValue("Win32_BaseBoard", "Product");
            string ramStr = GetMemoryInfo();
            string gpu = GetGpuInfo();
            string storageStr = GetStorageInfo();
            string ipAddress = GetIpAddress();

            List<SoftwareItem> softwareList = GetInstalledSoftware();

            string computerName = Environment.MachineName;
            ExportLocalCsvs(computerName, dept, name, ipAddress, osName, processor, motherboard, ramStr, gpu, storageStr, softwareList);

            string payload = BuildJsonPayload(dept, name, ipAddress, osName, processor, motherboard, ramStr, gpu, storageStr, softwareList);
            if (SendPayload(payload))
            {
                lblStatus.Text = "조사 완료 및 자산 서버 전송 완료!";
                lblStatus.ForeColor = Color.FromArgb(5, 150, 105); // #059669
                MessageBox.Show("성공적으로 서버 전송 및 자산 등록이 완료되었습니다!\n(백업용 파일도 현재 폴더에 PC_SPEC_" + computerName + ".csv / SW_LIST_" + computerName + ".csv 로 저장되었습니다.)", "성공", MessageBoxButtons.OK, MessageBoxIcon.Information);
                Application.Exit();
                return;
            }
            else
            {
                lblStatus.Text = "서버 전송 실패 (로컬 저장은 완료)";
                lblStatus.ForeColor = Color.FromArgb(217, 119, 6); // #d97706
                MessageBox.Show("서버 전송 중 오류가 발생했습니다.\n(로컬 백업 파일은 현재 폴더에 정상 생성되었습니다.)", "경고", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }

            txtDept.Enabled = true;
            txtName.Enabled = true;
            btnScan.Enabled = true;
        }

        private string GetWmiValue(string className, string propertyName)
        {
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT " + propertyName + " FROM " + className))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        var val = obj[propertyName];
                        if (val != null) return val.ToString().Trim().Replace("\0", "");
                    }
                }
            }
            catch { }
            return "";
        }

        private string GetMemoryInfo()
        {
            try
            {
                double totalBytes = 0;
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT TotalPhysicalMemory FROM Win32_ComputerSystem"))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        var val = obj["TotalPhysicalMemory"];
                        if (val != null) totalBytes = Convert.ToDouble(val);
                    }
                }
                int gb = (int)Math.Round(totalBytes / 1073741824.0);
                if (gb == 0) gb = (int)Math.Round(totalBytes / 1000000000.0);

                string ddr = "DDR";
                long speed = 0;
                int typeNum = 0;
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT Speed, SMBIOSMemoryType FROM Win32_PhysicalMemory"))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        var spVal = obj["Speed"];
                        if (spVal != null) speed = Convert.ToInt64(spVal);
                        
                        var typeVal = obj["SMBIOSMemoryType"];
                        if (typeVal != null) typeNum = Convert.ToInt32(typeVal);
                        break;
                    }
                }

                if (typeNum == 24) ddr = "DDR3";
                else if (typeNum == 26) ddr = "DDR4";
                else if (typeNum == 34) ddr = "DDR5";
                else
                {
                    if (speed >= 4800) ddr = "DDR5";
                    else if (speed >= 2133) ddr = "DDR4";
                    else if (speed >= 800) ddr = "DDR3";
                    else ddr = "DDR2";
                }

                return ddr + " " + gb + "GB";
            }
            catch { }
            return "RAM Info Unknown";
        }

        private string GetGpuInfo()
        {
            List<string> gpuNames = new List<string>();
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT Name FROM Win32_VideoController"))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        var val = obj["Name"];
                        if (val != null)
                        {
                            string name = val.ToString().Trim().Replace("\0", "");
                            if (name.IndexOf("virtual", StringComparison.OrdinalIgnoreCase) < 0 &&
                                name.IndexOf("indirect", StringComparison.OrdinalIgnoreCase) < 0 &&
                                name.IndexOf("mirror", StringComparison.OrdinalIgnoreCase) < 0 &&
                                name.IndexOf("render", StringComparison.OrdinalIgnoreCase) < 0 &&
                                name.IndexOf("rdp", StringComparison.OrdinalIgnoreCase) < 0 &&
                                name.IndexOf("remote", StringComparison.OrdinalIgnoreCase) < 0)
                            {
                                gpuNames.Add(name);
                            }
                        }
                    }
                }
            }
            catch { }
            return string.Join(", ", gpuNames.ToArray());
        }

        private string GetStorageInfo()
        {
            List<string> disks = new List<string>();
            try
            {
                uint? cDiskIndex = null;
                try
                {
                    using (ManagementObjectSearcher partSearcher = new ManagementObjectSearcher("ASSOCIATORS OF {Win32_LogicalDisk.DeviceID='C:'} WHERE AssocClass=Win32_LogicalDiskToPartition"))
                    {
                        foreach (ManagementObject part in partSearcher.Get())
                        {
                            var devId = part["DeviceID"];
                            if (devId != null)
                            {
                                string devIdStr = devId.ToString();
                                int hashIdx = devIdStr.IndexOf('#');
                                int commaIdx = devIdStr.IndexOf(',');
                                if (hashIdx != -1 && commaIdx != -1 && commaIdx > hashIdx)
                                {
                                    string indexStr = devIdStr.Substring(hashIdx + 1, commaIdx - hashIdx - 1);
                                    uint idx;
                                    if (uint.TryParse(indexStr, out idx))
                                    {
                                        cDiskIndex = idx;
                                    }
                                }
                            }
                        }
                    }
                }
                catch { }

                // Fallback: Default to disk 0 if WMI association query fails or returns nothing
                if (!cDiskIndex.HasValue)
                {
                    cDiskIndex = 0;
                }

                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT Index, Model, Size FROM Win32_DiskDrive"))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        var indexVal = obj["Index"];
                        var modelVal = obj["Model"];
                        var sizeVal = obj["Size"];

                        if (modelVal != null && sizeVal != null)
                        {
                            uint diskIndex = indexVal != null ? Convert.ToUInt32(indexVal) : 999;
                            double bytes = Convert.ToDouble(sizeVal);
                            int gb = (int)Math.Round(bytes / 1073741824.0);
                            if (gb == 0) gb = (int)Math.Round(bytes / 1000000000.0);
                            
                            string diskName = modelVal.ToString().Trim().Replace("\0", "") + " (" + gb + "GB)";
                            
                            if (cDiskIndex.HasValue && diskIndex == cDiskIndex.Value)
                            {
                                disks.Insert(0, "[C드라이브] " + diskName);
                            }
                            else
                            {
                                disks.Add(diskName);
                            }
                        }
                    }
                }
            }
            catch { }

            // If WMI failed completely and disks list is empty, return fallback info
            if (disks.Count == 0)
            {
                return "[C드라이브] Unknown Disk Drive";
            }

            return string.Join(", ", disks.ToArray());
        }

        private string GetIpAddress()
        {
            try
            {
                foreach (var ip in Dns.GetHostEntry(Dns.GetHostName()).AddressList)
                {
                    if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && !ip.ToString().StartsWith("127."))
                    {
                        return ip.ToString();
                    }
                }
            }
            catch { }
            return "";
        }

        private List<SoftwareItem> GetInstalledSoftware()
        {
            Dictionary<string, SoftwareItem> apps = new Dictionary<string, SoftwareItem>();

            string[] paths = new string[] {
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                @"SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
            };

            foreach (var path in paths)
            {
                ReadRegistryUninstall(RegistryHive.LocalMachine, path, apps);
                ReadRegistryUninstall(RegistryHive.CurrentUser, path, apps);
            }

            ReadRegistryUninstall(RegistryHive.LocalMachine, @"SOFTWARE\Microsoft\Office\ClickToRun\REGISTRY\MACHINE\Software\Microsoft\Windows\CurrentVersion\Uninstall", apps);

            bool hasOffice = false;
            foreach (var key in apps.Keys)
            {
                if (key.IndexOf("Office", StringComparison.OrdinalIgnoreCase) >= 0 || key.IndexOf("365", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    hasOffice = true;
                    break;
                }
            }

            if (!hasOffice)
            {
                try
                {
                    using (var wordKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\Winword.exe"))
                    {
                        if (wordKey != null)
                        {
                            string wordPath = wordKey.GetValue("") as string;
                            if (!string.IsNullOrEmpty(wordPath) && File.Exists(wordPath))
                            {
                                var verInfo = System.Diagnostics.FileVersionInfo.GetVersionInfo(wordPath);
                                string ver = verInfo.ProductVersion ?? "";
                                apps["Microsoft Office LTSC / 365 (Absolute)"] = new SoftwareItem
                                {
                                    Name = "Microsoft Office LTSC / 365 (Absolute)",
                                    Version = ver.Trim(),
                                    Publisher = "Microsoft Corporation"
                                };
                            }
                        }
                    }
                }
                catch { }
            }

            return new List<SoftwareItem>(apps.Values);
        }

        private void ReadRegistryUninstall(RegistryHive hive, string uninstallPath, Dictionary<string, SoftwareItem> apps)
        {
            try
            {
                using (var baseKey = RegistryKey.OpenBaseKey(hive, RegistryView.Registry64))
                using (var key = baseKey.OpenSubKey(uninstallPath))
                {
                    if (key != null)
                    {
                        foreach (var subkeyName in key.GetSubKeyNames())
                        {
                            using (var subkey = key.OpenSubKey(subkeyName))
                            {
                                if (subkey != null)
                                {
                                    string displayName = subkey.GetValue("DisplayName") as string;
                                    if (string.IsNullOrEmpty(displayName)) continue;
                                    displayName = displayName.Trim().Replace("\0", "");

                                    object sysComp = subkey.GetValue("SystemComponent");
                                    if (sysComp != null && Convert.ToInt32(sysComp) == 1)
                                    {
                                        if (displayName.IndexOf("Office", StringComparison.OrdinalIgnoreCase) < 0 &&
                                            displayName.IndexOf("365", StringComparison.OrdinalIgnoreCase) < 0 &&
                                            displayName.IndexOf("Hancom", StringComparison.OrdinalIgnoreCase) < 0 &&
                                            displayName.IndexOf("한컴", StringComparison.OrdinalIgnoreCase) < 0)
                                        {
                                            continue;
                                        }
                                    }

                                    string parentKeyName = subkey.GetValue("ParentKeyName") as string;
                                    if (!string.IsNullOrEmpty(parentKeyName))
                                    {
                                        if (displayName.IndexOf("Office", StringComparison.OrdinalIgnoreCase) < 0 &&
                                            displayName.IndexOf("365", StringComparison.OrdinalIgnoreCase) < 0 &&
                                            displayName.IndexOf("Hancom", StringComparison.OrdinalIgnoreCase) < 0 &&
                                            displayName.IndexOf("한컴", StringComparison.OrdinalIgnoreCase) < 0)
                                        {
                                            continue;
                                        }
                                    }

                                    if (displayName.IndexOf("Security Update", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                        displayName.IndexOf("Update for", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                        System.Text.RegularExpressions.Regex.IsMatch(displayName, @"KB\d{6}") ||
                                        displayName.IndexOf("Language Pack", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                        displayName.IndexOf("Language Experience Pack", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                        displayName.IndexOf("Visual C++", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                        displayName.IndexOf("Microsoft .NET", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                        displayName.IndexOf("Targeting Pack", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                        displayName.IndexOf("AhnLab Safe Transaction", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                        displayName.IndexOf("IPinside", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                        displayName.IndexOf("AnySign", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                        displayName.IndexOf("TouchEn", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                        displayName.IndexOf("INCAInternet", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                        displayName.IndexOf("VoiceEye", StringComparison.OrdinalIgnoreCase) >= 0)
                                    {
                                        continue;
                                    }

                                    string version = (subkey.GetValue("DisplayVersion") as string ?? "").Trim().Replace("\0", "");
                                    string publisher = (subkey.GetValue("Publisher") as string ?? "").Trim().Replace("\0", "");

                                    SoftwareItem item = new SoftwareItem { Name = displayName, Version = version, Publisher = publisher };
                                    apps[displayName] = item;
                                }
                            }
                        }
                    }
                }
            }
            catch { }
        }

        private void ExportLocalCsvs(string compName, string dept, string userName, string ip, string os, string cpu, string mb, string ram, string gpu, string storage, List<SoftwareItem> softwareList)
        {
            try
            {
                string hwFile = ".\\PC_SPEC_" + compName + ".csv";
                using (StreamWriter sw = new StreamWriter(hwFile, false, Encoding.GetEncoding("EUC-KR")))
                {
                    sw.WriteLine("\"컴퓨터이름\",\"부서\",\"사용자이름\",\"IP주소\",\"운영체제\",\"프로세서\",\"메인보드\",\"메모리\",\"그래픽카드\",\"저장장치\"");
                    sw.WriteLine(string.Format("\"{0}\",\"{1}\",\"{2}\",\"{3}\",\"{4}\",\"{5}\",\"{6}\",\"{7}\",\"{8}\",\"{9}\"",
                        EscapeCsv(compName), EscapeCsv(dept), EscapeCsv(userName), EscapeCsv(ip), EscapeCsv(os), EscapeCsv(cpu), EscapeCsv(mb), EscapeCsv(ram), EscapeCsv(gpu), EscapeCsv(storage)));
                }

                string swFile = ".\\SW_LIST_" + compName + ".csv";
                using (StreamWriter sw = new StreamWriter(swFile, false, Encoding.GetEncoding("EUC-KR")))
                {
                    sw.WriteLine("\"컴퓨터이름\",\"부서\",\"사용자이름\",\"프로그램명\",\"프로그램버전\",\"공급자\"");
                    if (softwareList.Count > 0)
                    {
                        foreach (var item in softwareList)
                        {
                            sw.WriteLine(string.Format("\"{0}\",\"{1}\",\"{2}\",\"{3}\",\"{4}\",\"{5}\"",
                                EscapeCsv(compName), EscapeCsv(dept), EscapeCsv(userName), EscapeCsv(item.Name), EscapeCsv(item.Version), EscapeCsv(item.Publisher)));
                        }
                    }
                    else
                    {
                        sw.WriteLine(string.Format("\"{0}\",\"{1}\",\"{2}\",\"설치된 프로그램 없음\",\"\",\"\"",
                            EscapeCsv(compName), EscapeCsv(dept), EscapeCsv(userName)));
                    }
                }
            }
            catch { }
        }

        private string EscapeCsv(string val)
        {
            if (string.IsNullOrEmpty(val)) return "";
            return val.Replace("\"", "\"\"");
        }

        private string BuildJsonPayload(string dept, string name, string ip, string os, string cpu, string mb, string ram, string gpu, string storage, List<SoftwareItem> softwareList)
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("{");
            sb.AppendFormat("\"p_customer_id\":\"{0}\",", EscapeJson(this.customerId));
            sb.AppendFormat("\"p_computer_name\":\"{0}\",", EscapeJson(Environment.MachineName));
            sb.AppendFormat("\"p_department\":\"{0}\",", EscapeJson(dept));
            sb.AppendFormat("\"p_user_name\":\"{0}\",", EscapeJson(name));
            sb.AppendFormat("\"p_ip_address\":\"{0}\",", EscapeJson(ip));
            sb.AppendFormat("\"p_os\":\"{0}\",", EscapeJson(os));
            sb.AppendFormat("\"p_processor\":\"{0}\",", EscapeJson(cpu));
            sb.AppendFormat("\"p_motherboard\":\"{0}\",", EscapeJson(mb));
            sb.AppendFormat("\"p_memory\":\"{0}\",", EscapeJson(ram));
            sb.AppendFormat("\"p_graphic_card\":\"{0}\",", EscapeJson(gpu));
            sb.AppendFormat("\"p_storage\":\"{0}\",", EscapeJson(storage));
            sb.Append("\"p_software\":[");

            for (int i = 0; i < softwareList.Count; i++)
            {
                var item = softwareList[i];
                sb.Append("{");
                sb.AppendFormat("\"program_name\":\"{0}\",", EscapeJson(item.Name));
                sb.AppendFormat("\"program_version\":\"{0}\",", EscapeJson(item.Version));
                sb.AppendFormat("\"publisher\":\"{0}\"", EscapeJson(item.Publisher));
                sb.Append("}");
                if (i < softwareList.Count - 1) sb.Append(",");
            }

            sb.Append("]");
            sb.Append("}");
            return sb.ToString();
        }

        private string EscapeJson(string val)
        {
            if (string.IsNullOrEmpty(val)) return "";
            return val.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r").Replace("\t", "\\t");
        }

        private bool SendPayload(string jsonPayload)
        {
            try
            {
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // TLS 1.2
                
                string url = this.supabaseUrl + "/rest/v1/rpc/sync_pc_asset";
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                request.Method = "POST";
                request.ContentType = "application/json; charset=utf-8";
                request.Headers["apikey"] = this.supabaseKey;
                request.Headers["Authorization"] = "Bearer " + this.supabaseKey;
                request.Headers["Prefer"] = "return=minimal";

                byte[] bodyBytes = Encoding.UTF8.GetBytes(jsonPayload);
                request.ContentLength = bodyBytes.Length;

                using (Stream reqStream = request.GetRequestStream())
                {
                    reqStream.Write(bodyBytes, 0, bodyBytes.Length);
                }

                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    if (response.StatusCode == HttpStatusCode.OK || 
                        response.StatusCode == HttpStatusCode.NoContent || 
                        response.StatusCode == HttpStatusCode.Created)
                    {
                        return true;
                    }
                }
            }
            catch (Exception ex)
            {
                string errBody = ex.Message;
                if (ex is WebException)
                {
                    WebException wex = (WebException)ex;
                    if (wex.Response != null)
                    {
                        try
                        {
                            using (var rdr = new StreamReader(wex.Response.GetResponseStream()))
                            {
                                errBody = rdr.ReadToEnd();
                            }
                        }
                        catch { }
                    }
                }
                MessageBox.Show("전송 에러 세부 내용: " + errBody, "전송 실패", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            return false;
        }
    }

    public class SoftwareItem
    {
        public string Name { get; set; }
        public string Version { get; set; }
        public string Publisher { get; set; }
    }
}
