#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
基于大模型视觉的数学公式识别器
使用qwen2.5-vl-72b-instruct模型进行图片识别
"""

import os
import base64
from openai import OpenAI
from PIL import Image
import io
import httpx

class LLMVisionOCR:
    def __init__(self, api_key="sk-1be9881d5f1b472292b5cc1d1336065c"):
        self.api_key = api_key

        # 创建自定义HTTP客户端，解决SSL问题
        http_client = httpx.Client(
            verify=False,  # 禁用SSL验证
            timeout=60.0
        )

        self.client = OpenAI(
            api_key=api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            http_client=http_client
        )
        self.model = "qwen2.5-vl-72b-instruct"
        
    def recognize_formula(self, image_file):
        """使用大模型识别数学公式"""
        try:
            print("🤖 启动大模型视觉识别...")
            print(f"📁 输入文件: {image_file}")

            # 检查文件是否存在
            if isinstance(image_file, str):
                if not os.path.exists(image_file):
                    error_msg = f"文件不存在: {image_file}"
                    print(f"❌ {error_msg}")
                    return {
                        'success': False,
                        'error': error_msg
                    }

                # 检查文件大小
                file_size = os.path.getsize(image_file)
                print(f"📊 文件大小: {file_size} 字节")

                if file_size == 0:
                    error_msg = "文件为空"
                    print(f"❌ {error_msg}")
                    return {
                        'success': False,
                        'error': error_msg
                    }

            # 处理图片
            image_data = self.prepare_image(image_file)
            if not image_data:
                return {
                    'success': False,
                    'error': '图片处理失败'
                }

            # 调用大模型
            result = self.call_vision_model(image_data)

            if result.get('success', False):
                print("✅ 大模型识别成功")
                return result
            else:
                print("❌ 大模型识别失败")
                return result

        except Exception as e:
            print(f"❌ 大模型识别出错: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': f'大模型识别出错: {str(e)}'
            }
    
    def prepare_image(self, image_file):
        """准备图片数据"""
        try:
            print(f"📷 处理图片: {image_file}")

            # 加载图片
            if isinstance(image_file, str):
                # 规范化路径
                image_file = os.path.normpath(image_file)
                print(f"📁 规范化路径: {image_file}")

                if not os.path.exists(image_file):
                    print(f"❌ 图片文件不存在: {image_file}")
                    return None

                # 使用更安全的方式打开文件
                try:
                    # 直接使用PIL打开，不使用with语句避免文件句柄问题
                    image = Image.open(image_file)
                    # 立即复制图片数据到内存，避免文件句柄问题
                    image = image.copy()
                    print(f"✅ 成功加载图片: {image.size}")
                except Exception as open_error:
                    print(f"❌ 无法打开图片文件: {open_error}")
                    return None
            else:
                try:
                    image = Image.open(image_file)
                    image = image.copy()
                    print(f"✅ 成功加载图片: {image.size}")
                except Exception as open_error:
                    print(f"❌ 无法打开图片: {open_error}")
                    return None

            print(f"📐 原始图片尺寸: {image.size}, 模式: {image.mode}")

            # 转换为RGB格式
            if image.mode != 'RGB':
                image = image.convert('RGB')
                print("🔄 已转换为RGB格式")

            # 调整图片大小 (如果太大的话)
            max_size = 1024
            if max(image.size) > max_size:
                ratio = max_size / max(image.size)
                new_size = tuple(int(dim * ratio) for dim in image.size)
                image = image.resize(new_size, Image.Resampling.LANCZOS)
                print(f"📏 调整图片尺寸: {image.size}")

            # 转换为base64
            try:
                buffer = io.BytesIO()
                # 确保使用PNG格式，并设置优化参数
                image.save(buffer, format='PNG', optimize=False)
                buffer.seek(0)
                image_data = buffer.getvalue()

                if len(image_data) == 0:
                    print("❌ 图片数据为空")
                    return None

                image_base64 = base64.b64encode(image_data).decode('utf-8')
                buffer.close()

                print(f"✅ 图片处理完成，base64长度: {len(image_base64)}")
                return image_base64

            except Exception as save_error:
                print(f"❌ 图片保存失败: {save_error}")
                return None

        except Exception as e:
            print(f"❌ 图片处理失败: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def call_vision_model(self, image_base64):
        """调用视觉模型"""
        try:
            print(f"🔑 使用API Key: {self.api_key[:10]}...")
            print(f"🤖 使用模型: {self.model}")

            # 构建消息
            messages = [
                {
                    'role': 'system',
                    'content': '''你是一个专业的数学公式识别专家。请仔细分析图片中的数学公式，并按照以下要求输出：

1. 准确识别图片中的所有数学公式
2. 将识别结果转换为标准的LaTeX格式
3. 每个公式用$$包围，例如：$$公式内容$$
4. 如果有多个公式，每个公式占一行
5. 保持公式的原始结构和符号
6. 特别注意：
   - 希腊字母：σ应写成\\sigma，τ应写成\\tau等
   - 函数：tanh应写成\\tanh，sin应写成\\sin等
   - 下标：用_{}表示，如x_t写成x_{t}
   - 上标：用^{}表示
   - 分数：用\\frac{}{}表示
   - 矩阵：用\\begin{pmatrix}...\\end{pmatrix}表示
   - 乘法：可以用\\cdot或*表示

请直接输出LaTeX格式的公式，不要添加额外的解释文字。'''
                },
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'text',
                            'text': '请识别这张图片中的数学公式，并转换为LaTeX格式：'
                        },
                        {
                            'type': 'image_url',
                            'image_url': {
                                'url': f'data:image/png;base64,{image_base64}'
                            }
                        }
                    ]
                }
            ]

            print("📡 构建API请求...")
            print(f"📊 图片数据长度: {len(image_base64)} 字符")

            # 调用API
            print("🔄 正在调用大模型API...")
            try:
                completion = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    max_tokens=2000,
                    temperature=0.1  # 降低温度以获得更准确的结果
                )
                print("✅ API调用成功")
            except Exception as api_error:
                print(f"❌ API调用失败: {api_error}")
                return {
                    'success': False,
                    'error': f'API调用失败: {str(api_error)}'
                }
            
            # 处理响应
            if completion.choices and len(completion.choices) > 0:
                content = completion.choices[0].message.content
                
                if content and content.strip():
                    # 直接使用大模型的输出，不进行修复
                    print(f"📝 大模型原始输出:\n{content}")

                    return {
                        'success': True,
                        'latex': content.strip(),
                        'method': '大模型视觉识别',
                        'confidence': 'very_high',
                        'confidence_score': 95,
                        'raw_text': content,
                        'model': self.model
                    }
                else:
                    return {
                        'success': False,
                        'error': '大模型返回空结果'
                    }
            else:
                return {
                    'success': False,
                    'error': '大模型API调用失败'
                }
                
        except Exception as e:
            print(f"❌ 大模型API调用失败: {e}")
            return {
                'success': False,
                'error': f'大模型API调用失败: {str(e)}'
            }
    


# 测试函数
def test_llm_vision_ocr():
    """测试大模型视觉OCR"""
    print("🧪 测试大模型视觉OCR...")
    
    try:
        ocr = LLMVisionOCR()
        print("✅ 大模型视觉OCR初始化完成")
        print(f"📡 使用模型: {ocr.model}")
        print(f"🔑 API Key: {ocr.api_key[:10]}...")
        
        # 可以在这里添加测试图片
        # result = ocr.recognize_formula("test_image.png")
        # print(f"测试结果: {result}")
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")

if __name__ == "__main__":
    test_llm_vision_ocr()
