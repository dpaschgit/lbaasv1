"""
Load Balancer Translator Factory Module

This module provides a factory for creating the appropriate translator
based on the load balancer type specified in the placement decision.
"""

from typing import Dict

from lb_translator_base import LBTranslatorBase
from nginx_translator import NginxTranslator
from f5_translator import F5Translator
from avi_translator import AviTranslator


class TranslatorFactory:
    """Factory for creating appropriate load balancer translators"""
    
    @staticmethod
    def get_translator(lb_type: str) -> LBTranslatorBase:
        """
        Get the appropriate translator for a load balancer type
        
        Args:
            lb_type: Load balancer type name
            
        Returns:
            LBTranslatorBase instance
            
        Raises:
            ValueError: If lb_type is not supported
        """
        if lb_type == 'NGINX':
            return NginxTranslator()
        elif lb_type == 'F5':
            return F5Translator()
        elif lb_type == 'AVI':
            return AviTranslator()
        else:
            raise ValueError(f"Unsupported load balancer type: {lb_type}")
