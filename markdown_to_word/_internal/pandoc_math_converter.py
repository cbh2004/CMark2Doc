#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Pandoc数学公式转换器
使用pandoc生成真正的Word数学公式
"""

import os
import subprocess
import tempfile
import shutil
from pathlib import Path
import uuid

class PandocMathConverter:
    def __init__(self):
        self.pandoc_available = self.check_pandoc()
    
    def check_pandoc(self):
        """检查pandoc是否可用"""
        try:
            # 尝试多个可能的pandoc路径
            pandoc_paths = [
                'pandoc',
                r'C:\Program Files\Pandoc\pandoc.exe',
                r'C:\Program Files (x86)\Pandoc\pandoc.exe',
                r'C:\Users\{}\AppData\Local\Pandoc\pandoc.exe'.format(os.getenv('USERNAME', '')),
            ]
            
            for pandoc_path in pandoc_paths:
                try:
                    result = subprocess.run([pandoc_path, '--version'], 
                                          capture_output=True, text=True, timeout=10)
                    if result.returncode == 0:
                        self.pandoc_path = pandoc_path
                        print(f"✅ 找到pandoc: {pandoc_path}")
                        return True
                except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
                    continue
            
            print("❌ 未找到pandoc")
            return False
        except Exception as e:
            print(f"❌ 检查pandoc时出错: {e}")
            return False
    
    def convert_markdown_content(self, markdown_content):
        """转换Markdown内容为Word文档"""
        if not self.pandoc_available:
            print("⚠️ Pandoc不可用，使用备用转换器")
            # 使用简单转换器作为备用方案
            from simple_effective_converter import SimpleEffectiveConverter
            simple_converter = SimpleEffectiveConverter()
            simple_converter.convert_markdown_content(markdown_content)
            # 创建临时文件
            temp_docx_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}.docx")
            simple_converter.doc.save(temp_docx_path)
            return temp_docx_path
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, encoding='utf-8') as temp_md:
            temp_md.write(markdown_content)
            temp_md_path = temp_md.name
        
        try:
            # 创建临时输出文件
            temp_docx_path = temp_md_path.replace('.md', '.docx')
            
            # 使用pandoc转换，启用数学公式支持
            cmd = [
                self.pandoc_path,
                temp_md_path,
                '-o', temp_docx_path,
                '--from', 'markdown+tex_math_dollars+tex_math_double_backslash',  # 支持$...$和$$...$$数学公式
                '--to', 'docx+native_numbering',
                '--mathml',  # 使用MathML格式（Word原生支持）
                '--standalone',
                '--wrap=preserve'  # 保持格式
            ]
            
            print(f"🔄 执行pandoc命令: {' '.join(cmd)}")
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0:
                print("✅ Pandoc转换成功")
                # 读取生成的docx文件
                with open(temp_docx_path, 'rb') as f:
                    self.docx_content = f.read()
                return temp_docx_path
            else:
                error_msg = f"Pandoc转换失败: {result.stderr}"
                print(f"❌ {error_msg}")
                raise Exception(error_msg)
                
        finally:
            # 清理临时文件
            try:
                os.unlink(temp_md_path)
            except:
                pass
    
    def save_to_file(self, output_path):
        """保存转换结果到文件"""
        if hasattr(self, 'docx_content'):
            with open(output_path, 'wb') as f:
                f.write(self.docx_content)
            return output_path
        else:
            raise Exception("没有可保存的内容")

def test_pandoc_converter():
    """测试pandoc转换器"""
    test_markdown = """
# 数学公式测试

## 行内公式
这是一个行内公式：$E = mc^2$，还有 $\\alpha + \\beta = \\gamma$。

## 块级公式
$$\\sum_{i=1}^{n} i^2 = \\frac{n(n+1)(2n+1)}{6}$$

$$\\int_{0}^{1} x^2 dx = \\frac{1}{3}$$

$$\\lim_{x \\to \\infty} \\frac{1}{x} = 0$$

## 复杂公式
$$\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\epsilon_0}$$

$$\\frac{\\partial f}{\\partial x} = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$$
"""
    
    converter = PandocMathConverter()
    if converter.pandoc_available:
        try:
            output_path = converter.convert_markdown_content(test_markdown)
            print(f"✅ 测试成功，输出文件: {output_path}")
            return output_path
        except Exception as e:
            print(f"❌ 测试失败: {e}")
            return None
    else:
        print("❌ Pandoc不可用，无法测试")
        return None

if __name__ == "__main__":
    test_pandoc_converter()
